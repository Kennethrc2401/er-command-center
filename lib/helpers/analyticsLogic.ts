type HeatmapEncounterInput = {
  _creationTime?: number;
};

type VolumeHeatmapRow = {
  hour: string;
  count: number;
  intensity: number;
};

export function calculateVolumeHeatmap(
  encounters: HeatmapEncounterInput[]
): VolumeHeatmapRow[] {
  // Initialize an array of 24 zeros for each hour of the day
  const hourlyCounts = new Array(24).fill(0);

  encounters.forEach((e) => {
    const arrivalTime = e._creationTime || Date.now();
    const hour = new Date(arrivalTime).getHours();
    hourlyCounts[hour] += 1;
  });

  const maxVolume = Math.max(...hourlyCounts);

  return hourlyCounts.map((count, hour) => ({
    hour: `${hour}:00`,
    count,
    intensity: maxVolume > 0 ? count / maxVolume : 0,
  }));
}