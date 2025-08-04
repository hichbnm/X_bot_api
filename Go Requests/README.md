# 🚀 Twitter/X API Bot – Post & Reply Tweets with XPFF Header

This project is a **reverse-engineered Twitter/X API bot** that can **post tweets** and **reply to tweets** while bypassing some of Twitter's browser-only headers like `X-Xp-Forwarded-For`.

It uses: ✅ **Chromedp** – to automate browser login & extract cookies. ✅ **Custom AES-GCM XPFF Header Generator** – mimicking Twitter’s WASM logic. ✅ **Bearer Token extraction** – scraping Twitter’s service worker script.

---

## 📂 Project Structure

```
├── auth_token.txt       # Stores the saved auth_token after manual login (expires in ~5 years)
├── getAuthToken.go      # Launches Chrome to get auth_token on first run
├── ct0.go               # Contains getBearerToken logic
├── testPost.go          # API server with /post-tweet endpoint
├── testReply.go         # API server with /reply-tweet endpoint
├── go.mod / go.sum      # Go dependencies
└── README.md            # This documentation
```

---

## 🔑 How It Works

### 1️⃣ **Get Auth Token (First-time Setup)**

Run:

```bash
 go run getAuthToken.go
```

👉 A Chrome window opens → Log in manually to Twitter/X. 👉 Once logged in, the code retrieves your **auth\_token** cookie and saves it in `auth_token.txt`.

This token is valid for a **long time (\~5 years)** and will be reused for future requests.

update : it will also get the guest_id cookie to fetch it in the future requests without needing the user to put it in the request 

---

### 2️⃣ **How Posting/Replying Works**

Each endpoint (`/post-tweet` and `/reply-tweet`) follows this process:

1. **Extract Bearer Token** → Calls `getBearerToken()` which scrapes Twitter’s JS service worker to get a valid token.
2. **Retrieve ct0 Cookie** → Opens Chrome, injects `auth_token`, reloads, and extracts the `ct0` CSRF cookie.
3. **Generate XPFF Header** → Uses `XPFFHeaderGenerator` (AES-GCM with SHA256 key derivation).
4. **Send GraphQL API Request** → Builds JSON body & sends it with proper headers to `CreateTweet` endpoint.

---

## 🔥 API Endpoints

### 📌 **1. Post a Tweet**

Run:

```bash
go run testPost.go
```

API will run at [**http://localhost:8099/post-tweet**](http://localhost:8099/post-tweet)

#### ✅ Example Request:

```bash
curl -X POST http://localhost:8099/post-tweet \
-H "Content-Type: application/json" \
-d '{"tweet_text": "Hello from my Go bot!"}'
```

---

### 📌 **2. Reply to a Tweet**

Run:

```bash
go run testReply.go
```

API will run at [**http://localhost:8099/reply-tweet**](http://localhost:8099/reply-tweet)

#### ✅ Example Request:

```bash
curl -X POST http://localhost:8099/reply-tweet \
-H "Content-Type: application/json" \
-d '{"tweet_text": "This is a working TEST reply!","reply_to_url":"https://x.com/TheDonOfApes/status/1950666717845455292"}'
```

---

## 🛠 Core Components Explained

### 🔹 `getAuthToken.go`

- Opens Chrome (not headless) → waits for manual login.
- Checks cookies repeatedly until it finds `auth_token`.
- Saves the token to `auth_token.txt`.

### 🔹 `getBearerToken()`

- Makes a GET request to Twitter’s service worker JS.
- Extracts the `Bearer <TOKEN>` string using string markers.

### 🔹 `GetCT0Cookie()`

- Opens Chrome → Injects `auth_token` into `.x.com` domain.
- Reloads → Extracts `ct0` CSRF cookie.

### 🔹 `XPFFHeaderGenerator`

- Mimics Twitter’s WASM logic.
- **Derives AES key:** `SHA256(base_key + guest_id)`
- **Encrypts JSON payload** containing UA & timestamp.
- Returns hex string → used as `X-Xp-Forwarded-For` header.

---

## ⚡ Why It’s Cool

✅ Automates Twitter API requests **without official API keys** 🎯 ✅ Demonstrates **reverse engineering WASM anti-bot mechanisms** 🔥 ✅ Uses **browser automation for cookie-based auth** (no credentials saved!) 🔐 ✅ Reusable for research in **bot detection bypasses** 🕵️‍♂️

---

## ⚠️ Disclaimer

This project is NOT for **educational & research purposes only.** **Please use it for spamming, malicious activities, or violating Twitter’s ToS. elon musk nik mok**

