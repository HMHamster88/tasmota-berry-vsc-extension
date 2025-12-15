import * as vscode from 'vscode';
import axios from 'axios'
import * as path from 'path';

const highlightDecorationType = vscode.window.createTextEditorDecorationType({
	// Use `backgroundColor` to highlight the entire line.
	// You can also use `borderWidth`, `borderStyle`, `overviewRulerColor`, etc.
	backgroundColor: 'rgba(255, 0, 0, 0.58)', // A semi-transparent yellow
	isWholeLine: true // Ensures the entire line background is colored
});

export function activate(context: vscode.ExtensionContext) {
	let tasmotaOutput = vscode.window.createOutputChannel("Tasmote execute output");

	function appendOutput(output: string) {
		const editor = vscode.window.activeTextEditor;
		const symbolIndex: number = output.indexOf('\x01');

		let outputText: string;

		if (symbolIndex !== -1) {
			outputText = output.substring(symbolIndex + 1);
		} else {
			outputText = output;
		}
		tasmotaOutput.append(outputText)
		if (outputText.includes('syntax_error') && editor) {
			const match = outputText.match(/input:(\d+)/)
			if (match) {
				const lineToHighlight = parseInt(match[1]) - 1
				const startPosition = new vscode.Position(lineToHighlight, 0);
				const endPosition = new vscode.Position(lineToHighlight, 0); // End column doesn't matter with isWholeLine: true
				const range = new vscode.Range(startPosition, endPosition);
				const ranges: vscode.Range[] = [range];
				editor.setDecorations(highlightDecorationType, ranges);
			}
		}
	}

	setInterval(async () => {
		let deviceConfig = vscode.workspace.getConfiguration('device');
		let outputpollong = deviceConfig.get<string>('outputPollong');
		if (outputpollong) {
			let deviceAddress = deviceConfig.get<string>('address');
			const response = await axios.get(deviceAddress! + '/bc', {
				params: {
					c2: '0'
				}
			});
			appendOutput(response.data)
		}
	}, 1000);

	const executeCommand = vscode.commands.registerCommand('tasmota-berry-vsc-extension.execute', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			editor.setDecorations(highlightDecorationType, []);
			const document = editor.document;
			const text = document.getText();

			let deviceConfig = vscode.workspace.getConfiguration('device');
			let deviceAddress = deviceConfig.get<string>('address');
			try {
				const response = await axios.get(deviceAddress! + '/bc', {
					params: {
						c2: '0',
						c1: text
					}
				});
				appendOutput(response.data)
			} catch (error) {
				vscode.window.showErrorMessage(`Tasmota execute error: ${error}`);
			}
		}
	})

	const uploadCommand = vscode.commands.registerCommand('tasmota-berry-vsc-extension.upload', async () => {
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const document = editor.document;
			const fileUri = document.uri;
			const filePath = fileUri.fsPath;

			const fileName = path.basename(filePath);

			const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);

			if (workspaceFolder) {
				const workspaceFolderPath = workspaceFolder.uri.fsPath;
				const relativePath = path.relative(workspaceFolderPath, filePath);

				try {
					let deviceConfig = vscode.workspace.getConfiguration('device');
					let deviceAddress = deviceConfig.get<string>('address');
					let resetVmAfterUpload = deviceConfig.get<boolean>('resetVmAfterUpload');
					const bodyFormData = new FormData();
					bodyFormData.append('name', '/' + relativePath.replace('\\', '/'));
					bodyFormData.append('content', document.getText());
					vscode.window.showInformationMessage('Uploading');
					const response = await axios.post(deviceAddress! + '/ufse', bodyFormData);
					vscode.window.showInformationMessage('Uploaded');
					if (resetVmAfterUpload) {
						const restartResponse = await axios.post(deviceAddress! + '/cm?cmnd=BrRestart%20')
						vscode.window.showInformationMessage(`Tasmota Berry WM restart: ${JSON.stringify(restartResponse.data)}`);
					}
				} catch (error) {
					vscode.window.showErrorMessage(`Tasmota uplaod error: ${error}`);
				}
			} else {
				vscode.window.showInformationMessage('File is not in an open workspace folder');
			}

		} else {
			vscode.window.showInformationMessage('No active text editor found.');
		}



	});

	context.subscriptions.push(uploadCommand);
	context.subscriptions.push(executeCommand);
}

// This method is called when your extension is deactivated
export function deactivate() { }
