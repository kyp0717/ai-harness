import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const REMINDER =
  "SDLC loop: feature work follows map, build, driver, verify, audit last. " +
  "The feature map is the contract. Logic features drive via CLI, UI features " +
  "via snapshot or screenshot. Skills: sdlc-loop, sdlc-loop-step-01-map through " +
  "sdlc-loop-step-05-audit.";

const LOOP_TEXT = `SDLC loop

1. Map. The feature map entry is the spec. Add, update, or delete it first.
2. Build. Code matches the map. Logic runs without the screen.
3. Driver. CLI subcommand for logic, snapshot or screenshot for UI.
4. Verify. Unit, live evidence, perf where speed matters. VERIFIED, NOT VERIFIED, or INCONCLUSIVE.
5. Audit. Once, at the end. The gate script checks map against code.

Skills: sdlc-loop, sdlc-loop-step-01-map, sdlc-loop-step-02-build,
sdlc-loop-step-03-driver, sdlc-loop-step-04-verify, sdlc-loop-step-05-audit.`;

export default function (pi: ExtensionAPI) {
  // Inject the reminder once per session, not every turn.
  let reminded = false;
  pi.on("before_agent_start", async (_event, _ctx) => {
    if (reminded) return {};
    reminded = true;
    return {
      message: {
        customType: "sdlc-loop",
        content: REMINDER,
        display: false,
      },
    };
  });

  pi.registerCommand("sdlc-loop", {
    description: "Print the SDLC loop",
    handler: async (_args, ctx) => {
      ctx.ui.notify(LOOP_TEXT, "info");
    },
  });
}
