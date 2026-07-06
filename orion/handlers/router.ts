import { Composer } from "grammy";
import type { Context } from "grammy";
import { composer as startComposer } from "./start.js";
import { composer as adminComposer } from "./admin.js";
import { composer as moderationComposer } from "./moderation.js";
import { composer as groupsComposer } from "./groups.js";
import { composer as notesComposer } from "./notes.js";
import { composer as filterComposer } from "./filter.js";
import { composer as blocklistComposer } from "./blocklist.js";
import { composer as antifloodComposer } from "./antiflood.js";
import { composer as greetingsComposer } from "./greetings.js";
import { composer as rulesComposer } from "./rules.js";
import { composer as funComposer } from "./fun.js";
import { composer as toolsComposer } from "./tools.js";
import { composer as afkComposer } from "./afk.js";
import { composer as reportingComposer } from "./reporting.js";
import { errorHandler } from "./errors.js";
import { replyMiddleware } from "../middlewares/reply.js";
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
  const filter = await import("./filter.js");
  const blocklist = await import("./blocklist.js");
  const antiflood = await import("./antiflood.js");
  const greetings = await import("./greetings.js");
  const rules = await import("./rules.js");
  const fun = await import("./fun.js");
  const tools = await import("./tools.js");
  const afk = await import("./afk.js");
  const reporting = await import("./reporting.js");
  const formatting = await import("./formatting.js");

  _HELP_MODULES["leadership"] = admin;
  _HELP_MODULES["moderation"] = mod;
  _HELP_MODULES["camp"] = groups;
  _HELP_MODULES["scrolls"] = notes;
  _HELP_MODULES["traps"] = filter;
  _HELP_MODULES["blocklist"] = blocklist;
  _HELP_MODULES["antiflood"] = antiflood;
  _HELP_MODULES["greetings"] = greetings;
  _HELP_MODULES["rules"] = rules;
  _HELP_MODULES["sport"] = fun;
  _HELP_MODULES["tools"] = tools;
  _HELP_MODULES["afar"] = afk;
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
  app.use(replyMiddleware);
  app.use(startComposer);
  app.use(adminComposer);
  app.use(moderationComposer);
  app.use(filterComposer);
  app.use(blocklistComposer);
  app.use(antifloodComposer);
  app.use(greetingsComposer);
  app.use(rulesComposer);
  app.use(notesComposer);
  app.use(groupsComposer);
  app.use(funComposer);
  app.use(toolsComposer);
  app.use(afkComposer);
  app.use(reportingComposer);
  app.use(formattingComposer);
  app.use(inlineComposer);
}
