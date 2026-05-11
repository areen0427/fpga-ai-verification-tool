import * as vscode from 'vscode';
import { VerificationResult } from './checker';

type ResultKind =
	| 'file'
	| 'critical'
	| 'warning'
	| 'success';

class ResultItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly kind: ResultKind,
		public readonly result?: VerificationResult
	) {
		super(label, vscode.TreeItemCollapsibleState.None);

		if (kind === 'critical') {
			this.iconPath = new vscode.ThemeIcon('error');
		}

		if (kind === 'warning') {
			this.iconPath = new vscode.ThemeIcon('warning');
		}

		if (kind === 'success') {
			this.iconPath = new vscode.ThemeIcon('check');
		}

		if (kind === 'file') {
			this.iconPath = new vscode.ThemeIcon('file');

			this.command = {
				command: 'fpga-ai-verification-tool.openReport',
				title: 'Open Report',
				arguments: [result]
			};
		}
	}
}

export class VerificationProvider implements vscode.TreeDataProvider<ResultItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<ResultItem | undefined | void>();

	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private rootItems: ResultItem[] = [];

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	updateResults(results: VerificationResult[]) {
		this.rootItems = [];

		for (const result of results) {
			const fileName =
				result.fileName.split(/[\\/]/).pop() || result.fileName;

			const criticalCount = result.criticalErrors.length;
			const warningCount = result.warnings.length;

			let suffix = '';

			if (criticalCount > 0) {
				suffix += ` ❌${criticalCount}`;
			}

			if (warningCount > 0) {
				suffix += ` ⚠${warningCount}`;
			}

			if (criticalCount === 0 && warningCount === 0) {
				suffix = ' ✅';
			}

			this.rootItems.push(
				new ResultItem(
					`${fileName}${suffix}`,
					'file',
					result
				)
			);
		}

		this.refresh();
	}

	getTreeItem(element: ResultItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: ResultItem): Thenable<ResultItem[]> {
		if (element) {
			return Promise.resolve([]);
		}

		return Promise.resolve(this.rootItems);
	}
}