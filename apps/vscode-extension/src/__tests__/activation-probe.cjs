// Runs inside VS Code's extension host for A16: report whether the InDusk
// extension activated in the workspace this window opened, then exit.
const fs = require("node:fs");
const vscode = require("vscode");

exports.run = async () => {
	const ext = vscode.extensions.getExtension("infinitedusky.indusk");
	for (let i = 0; i < 40 && !ext?.isActive; i++) await new Promise((r) => setTimeout(r, 250));
	fs.writeFileSync(
		process.env.A16_OUT,
		JSON.stringify({ found: Boolean(ext), active: Boolean(ext?.isActive) }),
	);
};
