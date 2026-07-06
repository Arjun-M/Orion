import { Composer } from "grammy";
import type { Context } from "grammy";
import { composer as startComposer } from "./start.js";
import { composer as adminComposer } from "./admin.js";
import { composer as moderationComposer } from "./moderation.js";
import { composer as groupsComposer } from "./groups.js";
import { composer as notesComposer } from "./notes.js";
import { composer as filtersComposer } from "./filters.js";
import { composer as funComposer } from "./fun.js";
import { composer as toolsComposer } from "./tools.js";
import { composer as afkComposer } from "./afk.js";
import { composer as fedsComposer } from "./feds.js";
import { composer as adminToolsComposer } from "./admin_tools.js";
import { composer as reportingComposer } from "./reporting.js";
import { errorHandler } from "./errors.js";
import { composer as inlineComposer } from "./inline.js";
import { composer as formattingComposer } from "./formatting.js";

export interface HelpModule {
  name: string;
  help: string;
}

export const HELPABLE: Record<string, HelpModule> = {};

const _HELP_MODULES: Record<string, { modName: string; helpText: string }> = {};

async function loadHelpModules(): Promise<void> {
  const admin = await import("./admin.js");
  const mod = await import("./moderation.js");
  const groups = await import("./groups.js");
  const notes = await import("./notes.js");
  const filters = await import("./filters.js");
  const fun = await import("./fun.js");
  const tools = await import("./tools.js");
  const afk = await import("./afk.js");
  const feds = await import("./feds.js");
  const adminTools = await import("./admin_tools.js");
  const reporting = await import("./reporting.js");
  const formatting = await import("./formatting.js");

  _HELP_MODULES["leadership"] = admin;
  _HELP_MODULES["moderation"] = mod;
  _HELP_MODULES["camp"] = groups;
  _HELP_MODULES["scrolls"] = notes;
  _HELP_MODULES["traps"] = filters;
  _HELP_MODULES["sport"] = fun;
  _HELP_MODULES["tools"] = tools;
  _HELP_MODULES["afar"] = afk;
  _HELP_MODULES["alliances"] = feds;
  _HELP_MODULES["master"] = adminTools;
  _HELP_MODULES["alerts"] = reporting;
  _HELP_MODULES["style"] = formatting;
}

export function buildHelpable(): void {
  for (const [key, mod] of Object.entries(_HELP_MODULES)) {
    const name = mod.modName || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const helpText = mod.helpText || "No wisdom recorded for this domain. Seek another.";
    HELPABLE[key] = { name, help: helpText };
  }
}

export async function registerHandlers(app: Composer<Context>): Promise<void> {
  await loadHelpModules();
  buildHelpable();
  app.use(errorHandler);
  app.use(startComposer);
  app.use(adminComposer);
  app.use(moderationComposer);
  app.use(groupsComposer);
  app.use(notesComposer);
  app.use(filtersComposer);
  app.use(funComposer);
  app.use(toolsComposer);
  app.use(afkComposer);
  app.use(fedsComposer);
  app.use(reportingComposer);
  app.use(adminToolsComposer);
  app.use(formattingComposer);
  app.use(inlineComposer);
}
