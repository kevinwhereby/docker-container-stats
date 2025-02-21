import Docker from "dockerode";
import express from "express";
import bodyParser from "body-parser";
import assert from "assert";
import { ContainerMonitor } from "./ContainerMonitor";

const app = express();
const port = 3000;
app.use(bodyParser.json());
const errorHandler: express.ErrorRequestHandler = (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
) => {
    res.setHeader("Content-Type", "application/json");
    console.error(err);
    const status = (err as unknown as { status: number }).status;
    if (status !== undefined && status < 500) {
        res.status(status).send(JSON.stringify({ error: err.message }));
        return;
    }

    res.status(500).send(JSON.stringify({ message: "Internal server error" }));
};
app.use(errorHandler);

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const containerMonitor = new ContainerMonitor();

function sendResponse({
    response,
    body,
    status,
}: {
    response: express.Response;
    body: Record<string, unknown>;
    status: number;
}) {
    response.status(status).end(JSON.stringify(body));
}

class ParseError extends Error {}

function parseMonitorBody(body: unknown): Record<string, string> {
    if (!body || !(body instanceof Object)) {
        throw new ParseError("Request body must be an object");
    }
    assert(body instanceof Object);
    const bodyObject = body as Record<string, unknown>;
    if (!bodyObject.labels) {
        throw new ParseError("labels property is required");
    }
    if (!(bodyObject.labels instanceof Object)) {
        throw new ParseError("labels property must be an object");
    }
    const labels = bodyObject.labels as Record<string, unknown>;
    if (Object.keys(labels).length === 0) {
        throw new ParseError("labels object must contain labels");
    }
    if (Object.values(labels).some((value) => typeof value !== "string" && typeof value !== null)) {
        throw new ParseError("label values must be string or null");
    }
    return labels as Record<string, string>;
}

app.post("/monitor", async (req, response) => {
    const body = await req.body;
    response.setHeader("Content-Type", "application/json");
    let labels: Record<string, string>;
    try {
        labels = parseMonitorBody(body);
    } catch (e) {
        sendResponse({ response, body: { message: e instanceof Error ? e.message : e }, status: 400 });
        return;
    }

    const labelsFilter = Object.entries(labels).map(([key, val]) => (val === null ? key : [key, val].join("=")));
    const results = await docker.listContainers({ filters: JSON.stringify({ label: labelsFilter }) });
    if (results.length < 1) {
        sendResponse({ response, body: { message: "Not found" }, status: 404 });
        return;
    }
    if (results.length > 1) {
        sendResponse({
            response,
            body: { message: "Found more than one container matching provided labels" },
            status: 400,
        });
        return;
    }

    const containerDetails = results.pop();
    assert(containerDetails, "No container details");

    if (containerMonitor.isMonitoring(containerDetails.Id)) {
        sendResponse({
            response,
            body: { message: "Already monitoring this container" },
            status: 400,
        });
        return;
    }

    const container = docker.getContainer(containerDetails.Id);
    if (!container) {
        sendResponse({
            response,
            body: { message: "Successfully listed details but could not fetch container" },
            status: 404,
        });
        return;
    }
    console.log("Monitoring", container.id);
    containerMonitor.monitorContainer(container);

    sendResponse({ response, body: { containerId: containerDetails.Id }, status: 201 });
});

app.get("/monitor/:containerId", (req, response) => {
    response.setHeader("Content-Type", "application/json");
    const containerId = req.params.containerId;
    if (!containerId) {
        sendResponse({ response, body: { message: "container ID is required" }, status: 400 });
        return;
    }

    const average = containerMonitor.calculateAverageCpuUsage(containerId);
    if (average === null) {
        sendResponse({ response, body: { message: "Not found" }, status: 404 });
        return;
    }

    sendResponse({ response, body: { average }, status: 200 });
});

app.listen(port, () => {
    console.log("Listening on port", port);
});
