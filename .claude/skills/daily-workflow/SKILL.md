---
name: daily-workflow
description: >
  每日工作流程協調，讓 mynotification 作為 front-end/back-end/staff 三個 Claude Code
  session 的統一指揮。使用時機：使用者說「開工」「今天開始」「daily start」或
  `/daily-workflow start` 時執行開工檢查（含主動跟 back-end/staff 對進度）；使用者說
  「收工」「今天結束」「daily end」或 `/daily-workflow end` 時執行收工彙整（commit、
  更新 memory、列出還在等對方回覆的事項）。
---

# 每日工作流程協調（daily-workflow）

## 角色說明

`mynotification`（這個 session，通常自稱 `front-end`）是使用者的統一指揮窗口。使用者只跟這個 session 對話確認決策；跟 `back-end`（`fastapi_pj`）、`staff`（`staff-scanner`）的協調（API 契約、進度追蹤、決策傳遞）一律由這個 session 透過 `SendMessage` 代為進行，使用者不需要自己開其他 session 視窗來回問。

決策權仍在使用者身上——這個 skill 的職責是「蒐集現況、彙整、代為詢問」，不是替使用者做決定。遇到需要使用者拍板的事（例如 commit 範圍、要不要 push、新功能怎麼做），還是要用 `AskUserQuestion` 或直接提問，不要自己假設。

## 判斷模式

讀 `args` 參數，或使用者這句話的語意：

- 包含「開工」「今天開始」「daily start」或 `args` 是 `start` → 執行下方 **Start 模式**
- 包含「收工」「今天結束」「daily end」或 `args` 是 `end` → 執行下方 **End 模式**
- 兩者都無法判斷時，用 `AskUserQuestion` 問清楚是要開工還是收工，不要自己猜一個執行。

## Start 模式（開工）

1. 執行 `git status` 與 `git log --oneline -5`，確認 `mynotification` 這個 repo 目前乾不乾淨、有沒有上次沒收尾完的東西（未提交的變動、沒推的 commit）。
2. 讀取記憶系統裡跟這個專案相關的內容（尤其是名稱像 `project_status_2026-09.md` 這類「開新 session 先讀這個」的 project 記憶），以及 repo 根目錄下 `plan-*.md`／`backlog.md` 裡的 Open questions／Known open items／待辦段落，整理出目前已知卡住或需要追蹤的項目清單。**這份清單每次都要重新讀最新的 memory，不要背用之前對話記住的死清單**——已知的落差歷史上包括過 ECPay 金鑰、產品資料維護、點餐資料維護、FCM push receipt 驗證這類項目，但這些狀態會隨時間改變，一切以當下讀到的內容為準。
3. 呼叫 `ListAgents`，確認 `back-end`／`staff` 兩個 session 目前是否在線、目前顯示的名稱是什麼。**這兩個 session 的顯示名稱歷史上都飄移過**（`back-end` 曾經是 `fastapi-pj-a7`／`fastapi-pj-8f` 之類的自動產生名稱；反過來 `back-end` 那邊看到的 `mynotification` 也飄移過）。如果 `ListAgents` 列出的名稱跟預期的 `back-end`／`staff` 對不上，**先跟使用者確認清楚再送訊息**，不要自己假設某個陌生名稱就是同一個 session。
4. 對確認在線的 `back-end`／`staff`，各發一則 `SendMessage`，**內容一律使用繁體中文**，針對步驟 2 列出的已知卡住/追蹤項目逐一點名詢問最新狀態（例如：「想跟你確認一下 ECPay 金鑰申請得怎麼樣了」「產品資料維護那邊現在進度到哪」），不要發「有什麼新進度嗎」這種空泛問句浪費對方的注意力。如果某個 session 不在線（`ListAgents` 沒列出來），就跳過，在給使用者的彙整裡註明「`back-end`/`staff` 目前沒開，沒發訊息」。
5. `SendMessage` 發出去後**不要在同一輪阻塞等待回覆**——對方的回覆之後會用 cross-session-message 的形式通知進來，屆時再更新使用者。當下先把「今日待辦」整理給使用者，內容包含：
   - 本機（mynotification）未完成/未提交的事項
   - 已知的外部卡住依賴（例如等對方的金鑰、等對方的 API 部署）
   - 正在等哪些 session 回覆、問了什麼問題
6. 如果使用者還沒說今天要做什麼新功能/任務，順勢詢問；如果使用者已經明確說了要做什麼，就直接開始那項工作，不用再多問一次。

## End 模式（收工）

1. 執行 `git status`，列出目前未提交的變動。
2. 如果有未提交變動：**先問使用者要怎麼分 commit**，不要自己假設「全部塞成一包」或「全部拆開」——如果變動明顯是同一個功能的一部分就可以建議一個合理的分法，但最終範圍要使用者確認。如果有多個功能的改動糾纏在同一批共用檔案裡（例如 `app/_layout.tsx`、`CLAUDE.md` 這類跨功能都會動到的檔案），用「先看整份 diff、依區塊手動重建每個 commit 該有的中間狀態」的方式拆分，而不是整份塞進某一個 commit。
3. Commit 完成之後**不要自動 `git push`**，除非使用者在這個流程裡明確要求要 push。
4. 回顧今天這輪對話：有沒有跟 `back-end`／`staff` 開啟但**還沒收到回覆**的協調事項？把這些列出來，提醒使用者這些是「還在等對方」的開放項目，不需要現在追，但下次開工時要記得先檢查有沒有回覆。
5. 更新記憶系統：把今天的進度寫回對應的 project 記憶（例如 `project_status_2026-09.md` 或今天工作對應的功能記憶），內容至少包含：
   - 今天完成了什麼（對應到剛剛的 commit）
   - 還卡住什麼、原因是什麼
   - 今天跟 `back-end`／`staff` 對過什麼新資訊或達成什麼共識
   - 下次開工（明天）應該先做什麼、先檢查什麼
6. 給使用者一份簡短的收工彙整：今天做了什麼、commit 了幾個、還有哪些 open item、跟哪些對方 session 的協調還在等回覆。

## 注意事項

- **跟 `back-end`／`staff` 的 `SendMessage` 訊息內容一律使用繁體中文**（這是 `CLAUDE.md` 的既有規則，這裡重申一次避免遺漏），不要用英文溝通。
- 不要幫 `back-end`／`staff` 做決定或直接修改它們 repo 裡的檔案——這個 skill 的職責範圍只在 `mynotification` 這個 repo 內，跨 session 的協調一律透過文字訊息進行。
- 每天發給對方的訊息要「針對性」點名已知項目，不要每天發一樣的萬用問句，這樣會浪費對方 session 的注意力與 token。
- 這個 skill **不會**在 session 開啟/關閉時自動觸發（沒有掛 `SessionStart`/`SessionEnd` hook），一定要使用者自己打字（例如「開工」「收工」）才會動作；專案另外掛了一個 `UserPromptSubmit` hook（見 `.claude/hooks/daily-workflow-trigger.cjs`），作用是在偵測到這些關鍵字時用 harness 層級保證觸發，而不是完全依賴模型自己判斷 `description` 有沒有比對到——但觸發的前提永遠是使用者自己打出那句話，不是憑空自動執行。

## 完成後檢查清單

**Start：**
- [ ] `git status`／`git log` 檢查過
- [ ] 已知卡住項目清單已從最新 memory／`plan-*.md` 重新讀取（不是背之前的舊清單）
- [ ] `ListAgents` 確認過 `back-end`／`staff` 在線狀態，名稱有疑慮時已跟使用者確認過
- [ ] 已對在線的雙方發出針對性進度詢問（訊息是繁體中文）
- [ ] 已給使用者一份今日待辦彙整

**End：**
- [ ] `git status` 檢查過，有變動時 commit 範圍已跟使用者確認
- [ ] Commit 完成（如果需要），沒有自動 `push`
- [ ] 開放中、還在等對方回覆的跨 session 協調事項已列出
- [ ] 對應的 memory 已更新，反映今天的實際狀態
- [ ] 已給使用者一份收工彙整
