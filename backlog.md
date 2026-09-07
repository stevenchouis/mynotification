# Backlog：未來要加的功能

尚未排入開發、僅先記錄構想的功能清單。真的要動工時再展開成獨立的 `plan-*.md`（比照 `plan-line-login.md`／`plan-admin-coupon.md` 等既有慣例）並跟 `back-end` session 確認 API 契約。

## 收藏商品到貨/降價通知

**構想**：使用者收藏（願望清單）的商品，如果之後補貨（`stock` 從 0 變回 > 0）或降價（`price` 下降），系統主動推播通知使用者。

**背景**：源自討論購物車/金流功能時，決定新商店的收藏清單要存 DB（`user_id` + `product_id`，不像舊版 DummyJSON 收藏只存裝置本機）——收藏存在後端才有辦法在背景比對庫存/價格變化並主動通知，這是選擇「收藏存 DB」而非「比照舊版存本機」的其中一個理由。

**大致需要**：
- 後端：商品 `price`／`stock` 變動時的偵測機制（DB trigger、排程 job 定期比對，或後台改價/補貨的操作本身觸發），比對哪些使用者收藏了這個商品
- 後端：既有的 Expo Push Token 推播基礎設施（`POST /api/v1/notifications`類似機制，參考現有優惠券/一般通知的推播路徑）可以直接複用，不用重新設計
- 前端：收到推播後導頁到該商品詳情，這部分等商店的商品詳情畫面做出來後才有目的地可導
- 依賴：新商店的 `Favorite`/`Wishlist` 表與商品 API 要先存在

**2026-09-06 補充討論（跟 `back-end` 確認）**：目前 `products.py` 只有 `GET` 兩支，完全沒有補貨/改價的操作管道（`stock`/`price` 只會被 `seed_products.py` 或下單扣庫存動到）——也就是說要做這個通知功能，前提是要先有個地方能實際「觸發」到貨/改價這個動作，不然後端偵測不到「發生了什麼變化」。已確認方向：**這個操作介面放進 `staff` App**（跟桌位管理一樣屬於「店內營運工具」性質，跟顧客端 mynotification 職責不同），初步設計是 `PATCH /api/v1/products/{id}`（改 `stock`/`price`/`is_active`）+ 偵測異動（`stock` 0→正數＝到貨、`price` 調降＝降價）觸發推播。`back-end` 建議等目前手上的 `role` 機制批次工作（見 CLAUDE.md 相關 session 溝通記錄）做完、桌位管理穩定後再排這個，這次先不展開成獨立 plan.md。
