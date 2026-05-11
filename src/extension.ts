import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand(
		'fpga-ai-verification-tool.analyzeFile',
		async () => {
			const editor = vscode.window.activeTextEditor;

			if (!editor) {
				vscode.window.showErrorMessage("No active file.");
				return;
			}

			const document = editor.document;
			const text = document.getText();

			const isHDL =
				document.fileName.endsWith(".v") ||
				document.fileName.endsWith(".sv") ||
				document.fileName.endsWith(".vhd");

			if (!isHDL) {
				vscode.window.showWarningMessage(
					"Open a Verilog, SystemVerilog, or VHDL file."
				);
				return;
			}

			const warnings: string[] = [];
			const criticalErrors: string[] = [];

			// ---------- Critical checks ----------

			if (!text.match(/\bmodule\s+\w+/i)) {
				criticalErrors.push("No Verilog module declaration found.");
			}

			if (!text.match(/\bendmodule\b/i)) {
				criticalErrors.push("Missing `endmodule`.");
			}

			const beginCount = (text.match(/\bbegin\b/g) || []).length;
			const endCount = (text.match(/\bend\b/g) || []).length;

			if (beginCount !== endCount) {
				criticalErrors.push(
					`Unbalanced begin/end blocks. Found ${beginCount} begin and ${endCount} end.`
				);
			}

			const openParenCount = (text.match(/\(/g) || []).length;
			const closeParenCount = (text.match(/\)/g) || []).length;

			if (openParenCount !== closeParenCount) {
				criticalErrors.push(
					`Unbalanced parentheses. Found ${openParenCount} "(" and ${closeParenCount} ")".`
				);
			}

			if (!text.match(/\binput\b/i) && !text.match(/\boutput\b/i)) {
				criticalErrors.push("No input/output ports detected. Testbench generation may fail.");
			}

			// ---------- Warning checks ----------

if (!text.includes("default_nettype none")) {
	warnings.push("Consider adding `default_nettype none` to catch undeclared wires.");
}

// Better blocking assignment detection
const sequentialBlocks =
	text.match(/always\s*@\s*\([^)]*posedge[^)]*\)[\s\S]*?end/g) || [];

const hasBlockingInSequential = sequentialBlocks.some(block =>
	/(?<![<>=!])=(?![=>=])/g.test(block)
);

if (hasBlockingInSequential) {
	warnings.push(
		"Possible blocking assignment `=` inside sequential logic. Use `<=` for flip-flops."
	);
}

// Missing reset detection
if (
	text.match(/always\s*@\s*\(\s*posedge|always_ff\s*@/i) &&
	!text.match(/reset|rst/i)
) {
	warnings.push("Sequential logic found, but no reset signal detected.");
}

// Case statement without default
if (
	text.match(/\bcase\s*\(/i) &&
	!text.match(/\bdefault\s*:/i)
) {
	warnings.push("Case statement found without a `default` branch.");
}

// Possible latch inference
if (
	text.match(/always\s*@\s*\*/i) &&
	!text.match(/\belse\b/i)
) {
	warnings.push(
		"Combinational block may infer a latch. Check for missing `else` or default assignments."
	);
}

			// ---------- Output ----------

			const output = vscode.window.createOutputChannel("FPGA AI Verification Tool");
			output.clear();

			output.appendLine(`Analysis for: ${document.fileName}`);
			output.appendLine("");

			output.appendLine("CRITICAL ERRORS");
			output.appendLine("----------------");

			if (criticalErrors.length === 0) {
				output.appendLine("None");
			} else {
				criticalErrors.forEach((error, index) => {
					output.appendLine(`${index + 1}. ${error}`);
				});
			}

			output.appendLine("");
			output.appendLine("WARNINGS");
			output.appendLine("--------");

			if (warnings.length === 0) {
				output.appendLine("None");
			} else {
				warnings.forEach((warning, index) => {
					output.appendLine(`${index + 1}. ${warning}`);
				});
			}

			output.show();

			if (criticalErrors.length > 0) {
				vscode.window.showErrorMessage(
					`Found ${criticalErrors.length} critical error(s). Testbench generation blocked.`
				);
			} else if (warnings.length > 0) {
				vscode.window.showWarningMessage(
					`Found ${warnings.length} warning(s). Code can still be used for testbench generation.`
				);
			} else {
				vscode.window.showInformationMessage(
					"No HDL issues found. Code is ready for testbench generation."
				);
			}
		}
	);

	context.subscriptions.push(disposable);
}

export function deactivate() {}