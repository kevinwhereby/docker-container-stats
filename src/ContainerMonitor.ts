import type Docker from "dockerode";
import EventEmitter from "events";
import assert from "assert";

type ContainerStatsStream = EventEmitter<{ data: [Buffer] }>;
interface Stat {
    time: number;
    cpuUsagePercentage: number;
}

export class ContainerMonitor {
    private containerStats: Record<string, Stat[]> = {};
    private streams: Record<string, ContainerStatsStream> = {};
    private containerStateMonitorIntervals: Record<string, NodeJS.Timeout> = {};
    constructor() {}

    async monitorContainer(container: Docker.Container) {
        const statsStream = (await container.stats()) as unknown as ContainerStatsStream;
        this.containerStats[container.id] = [];
        statsStream.on("data", (raw: Buffer) => {
            const { cpu_stats: cpuStats, precpu_stats: precpuStats } = JSON.parse(
                raw.toString(),
            ) as Docker.ContainerStats;
            if (!precpuStats.system_cpu_usage || !cpuStats.system_cpu_usage) {
                return;
            }

            const cpuDelta = cpuStats.cpu_usage.total_usage - precpuStats.cpu_usage.total_usage;
            const systemCpuDelta = cpuStats.system_cpu_usage - precpuStats.system_cpu_usage;
            const numberCpus = cpuStats.online_cpus;
            const cpuUsagePercentage = (cpuDelta / systemCpuDelta) * numberCpus * 100.0;
            this.containerStats[container.id]?.push({ time: performance.now(), cpuUsagePercentage });
        });
        this.streams[container.id] = statsStream;
        this.monitorContainerState(container);
    }

    calculateAverageCpuUsage(containerId: string) {
        const containerStats = this.containerStats[containerId];
        if (!containerStats) {
            return null;
        }
        const stats = [...containerStats];
        if (stats.length === 0) return 0;
        if (stats.length === 1) return stats[0]?.cpuUsagePercentage;

        assert(stats[0], "Stats length error");

        let weightedSum = 0;
        let totalDuration = 0;

        for (let i = 0; i < stats.length - 1; i++) {
            const thisStat = stats[i];
            const nextStat = stats[i + 1];
            assert(thisStat, "Stats loop error for i");
            assert(nextStat, "Stats loop error for i+1");
            const duration = nextStat.time - thisStat.time;
            weightedSum += thisStat.cpuUsagePercentage * duration;
            totalDuration += duration;
        }

        return weightedSum / totalDuration;
    }

    private monitorContainerState(container: Docker.Container) {
        this.containerStateMonitorIntervals[container.id] = setInterval(async () => {
            try {
                const result = await container.inspect();
                if (result.State.Status !== "running") {
                    this.cleanup(container.id);
                }
            } catch (error) {
                console.error("state monitor error", error);
                this.cleanup(container.id);
            }
        }, 1000);
    }

    private cleanup(containerId: string) {
        console.log("Cleaning up", containerId);
        const interval = this.containerStateMonitorIntervals[containerId];
        if (!interval) {
            console.error("No interval cleaning up", containerId);
        }
        clearInterval(interval);
        delete this.containerStats[containerId];
        delete this.streams[containerId];
        delete this.containerStateMonitorIntervals[containerId];
    }

    isMonitoring(id: string) {
        return !!this.containerStats[id];
    }
}
