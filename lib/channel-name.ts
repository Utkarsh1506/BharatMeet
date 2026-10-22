const DEFAULT_CHANNEL_NAMES = new Set(["general", "samanya sabha"]);

export const isDefaultChannelName = (name: string) =>
  DEFAULT_CHANNEL_NAMES.has(name.trim().toLocaleLowerCase("en-US"));

// Keep old persisted room names readable in English without requiring a data migration.
export const getChannelDisplayName = (name: string) =>
  name.trim().toLocaleLowerCase("en-US") === "samanya sabha" ? "general" : name;
