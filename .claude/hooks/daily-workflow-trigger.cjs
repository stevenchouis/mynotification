#!/usr/bin/env node
// UserPromptSubmit hook：偵測使用者訊息是否包含「開工」「收工」等關鍵字，命中時輸出
// systemMessage/additionalContext 提示 Claude 立即呼叫 daily-workflow skill。
// 這支腳本會在「每一則」使用者訊息送出時執行，所以任何例外都必須吞掉、預設放行
// （{"continue": true}），絕對不能因為這裡壞掉就卡住使用者的其他所有訊息。

let raw = '';
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    // 部分呼叫端（例如 PowerShell 管道）會在字串前面加 UTF-8 BOM（U+FEFF），直接丟給
    // JSON.parse 會炸掉，先去掉再解析。用 charCodeAt 判斷，避免原始碼裡藏不可見字元。
    const cleaned = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
    const input = JSON.parse(cleaned || '{}');
    const prompt = String(input.user_prompt || '');

    const startPattern = /(開工|daily-workflow\s+start|\/daily-workflow\s+start)/i;
    const endPattern = /(收工|daily-workflow\s+end|\/daily-workflow\s+end)/i;

    let mode = null;
    if (startPattern.test(prompt)) mode = 'start';
    else if (endPattern.test(prompt)) mode = 'end';

    if (!mode) {
      process.stdout.write(JSON.stringify({ continue: true }));
      return;
    }

    const message = mode === 'start'
      ? '偵測到「開工」指令。請立即使用 Skill 工具呼叫 daily-workflow（args: "start"），依照它的 Start 模式步驟執行（含主動 ping back-end/staff），不要只是回覆文字說要做什麼。'
      : '偵測到「收工」指令。請立即使用 Skill 工具呼叫 daily-workflow（args: "end"），依照它的 End 模式步驟執行（git 狀態檢查、詢問 commit 範圍、更新 memory），不要只是回覆文字說要做什麼。';

    process.stdout.write(JSON.stringify({
      continue: true,
      suppressOutput: false,
      systemMessage: message,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: message,
      },
    }));
  } catch {
    process.stdout.write(JSON.stringify({ continue: true }));
  }
});
