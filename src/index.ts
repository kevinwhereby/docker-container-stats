import Docker from "dockerode";
import express from "express";
import bodyParser from "body-parser";
import assert from "assert";
import { ContainerMonitor } from "./ContainerMonitor";

const app = express();
const port = 3000;
app.use(bodyParser.json());

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const containerMonitor = new ContainerMonitor();

app.post("/monitor", async (req, res) => {
    const body = await req.body;
    if (!body.labels) {
        res.status(400).send("labels property is required");
        return;
    }
    if (typeof body.labels !== "object") {
        res.status(400).send("labels property must be an object");
        return;
    }
    const labels = body.labels;
    if (Object.keys(labels).length === 0) {
        res.status(400).send("labels object must contain labels");
        return;
    }
    if (Object.values(labels).some((value) => typeof value !== "string" && typeof value !== null)) {
        res.status(400).send("label values must be string or null");
        return;
    }

    const labelsFilter = Object.entries(labels).map(([key, val]) => (val === null ? key : [key, val].join("=")));
    const results = await docker.listContainers({ filters: JSON.stringify({ label: labelsFilter }) });
    if (results.length < 1) {
        res.sendStatus(404);
        return;
    }
    if (results.length > 1) {
        res.status(400).send("Found more than one container matching provided labels");
        return;
    }

    const containerDetails = results.pop();
    assert(containerDetails, "No container details");

    const container = docker.getContainer(containerDetails.Id);
    if (!container) {
        res.status(404).send("Successfully listed details but could not fetch container");
        return;
    }
    console.log("Monitoring", container.id);
    containerMonitor.monitorContainer(container);

    res.status(201).send(containerDetails.Id);
});

app.get("/monitor/:containerId", (req, res) => {
    const containerId = req.params.containerId;
    if (!containerId) {
        res.status(400).send("container ID is required");
        return;
    }

    const average = containerMonitor.calculateAverageCpuUsage(containerId);
    if (average === null) {
        res.sendStatus(404);
        return;
    }

    res.status(200).send(JSON.stringify({ average }));
});

app.listen(port, () => {
    console.log("Listening on port", port);
});
