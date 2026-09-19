# Plan: 使用者暱稱欄位

## Goal
好友功能上線後發現 User 沒有暱稱欄位，好友列表/好友卡片顯示的 `username` 是後端暫代值（email 前綴遮罩 `st***`，純 LINE 帳號是 `用戶{id}`），好友一多就分不出誰是誰。使用者決定（2026-09-19）新增暱稱欄位：使用者可在「設定」頁自行設定暱稱，好友相關畫面優先顯示暱稱。

順帶發現的既有問題：`schemas/user.py` 的 `UserUpdate` 有 `username`，但 `models.User` 沒有對應 column、`GET /users/me` 也不回傳，`PUT` 這個欄位被靜默忽略；`settings.tsx` 原本讀 `user.username` 永遠是空的（一直顯示 fallback「帳號」）。這次改讀 `nickname`。

## Architecture / flow
- **back-end**：`User.nickname`（String, nullable，向下相容 migration）；`GET /users/me` 回傳 `nickname`；`PUT /users/me` 的 `UserUpdate` 新增 `nickname`（trim 後 1–20 字，空字串/純空白存 null，超過 20 字 422，不要求唯一）；好友 API 的 `username` 改成「nickname 優先，沒有才 fallback 遮罩值」，回應欄位名稱不變；推播文案若帶對方名稱也走同一個函式。
- **mynotification**：`settings.tsx` 個人資料卡片的名稱可點擊，開 Modal 輸入暱稱（`api.put('/api/v1/users/me', { nickname })`，成功後 invalidate `['userProfile']`）；`app/friends/my-code.tsx` 顯示自己的暱稱。好友列表/詳情讀 API 的 `username`，前端**不需改動**。

## Scope
### May modify（mynotification）
- `app/(drawer)/(tabs)/settings.tsx` — 暱稱顯示與編輯 Modal
- `app/friends/my-code.tsx` — 名稱改讀 `nickname`
### Must not modify
- `app/friends/index.tsx`、`app/friends/[friendshipId].tsx`、`types/friends.ts` — 後端維持 `username` 欄位名稱，無需動
- 註冊流程 — 暱稱不強制填

## Constraints
- 暱稱不要求唯一（好友卡片同時顯示會員編號可區分）；前端 `maxLength=20` 先擋，後端為準
- 暱稱是給好友看的公開名稱，不含 email

## Verification
- 設定頁點名稱 → 輸入暱稱儲存 → 名稱更新；清空儲存 → 回到「設定暱稱」
- 兩帳號互加好友後，對方好友列表/邀請/卡片與推播顯示我的暱稱；未設定暱稱時顯示遮罩 fallback
- 超過 20 字被擋；`tsc`/`lint` 乾淨；淺色/深色模式 Modal 顯示正常

## Done definition
- [x] 前端 `settings.tsx`、`my-code.tsx` 完成，`tsc`/`lint` 乾淨
- [x] back-end 新增欄位、PUT/GET、好友 API fallback 並部署（commit 9bb2905，migration e62e472e4275，2026-09-19 已上線，契約與本 plan 一致；`UserUpdate.username` 已移除；`PUT /users/me` 目前只處理 `avatar_url`／`nickname`，`birthday` 欄位 schema 有收但 endpoint 未套用）
- [ ] 兩帳號實測通過
- [ ] Commit

## Open questions
- （已解決）`UserUpdate.username` 已由 back-end 移除
