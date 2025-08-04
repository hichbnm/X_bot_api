package main

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"
)

type XPFFHeaderGenerator struct {
	BaseKey string
}

type ReplyRequest struct {
	TweetText string `json:"tweet_text"`
	ReplyURL  string `json:"reply_to_url"`
}

func main() {
	http.HandleFunc("/reply-tweet", handleReplyTweet)

	fmt.Println("🚀 API running on http://localhost:8099")
	http.ListenAndServe(":8099", nil)
}

// Read auth_token from file
func readAuthTokenFromFile() (string, error) {
	data, err := os.ReadFile("auth_token.txt")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

// Read guest_id from guest_id.txt
func readGuestIdFromFile() (string, error) {
	data, err := os.ReadFile("guest_id.txt")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

// Handler
func handleReplyTweet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ReplyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	tweetID := extractTweetID(req.ReplyURL)
	if tweetID == "" {
		http.Error(w, "Invalid reply_to_url", http.StatusBadRequest)
		return
	}

	// Get tokens
	bearerToken, err := getBearerToken()
	if err != nil {
		http.Error(w, "Failed to get bearer token: "+err.Error(), http.StatusInternalServerError)
		return
	}
	authToken, _ := readAuthTokenFromFile()
	guest_id, _ := readGuestIdFromFile()

	ct0, err := GetCT0Cookie(authToken)
	if err != nil {
		http.Error(w, "Failed to get ct0 cookie: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Post reply
	resp := replyToTweet(authToken, ct0, bearerToken, req.TweetText, guest_id, tweetID, req.ReplyURL)

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(fmt.Sprintf(`{"response": %q}`, resp)))
}

// Extract Tweet ID
func extractTweetID(url string) string {
	re := regexp.MustCompile(`status/(\d+)`)
	match := re.FindStringSubmatch(url)
	if len(match) > 1 {
		return match[1]
	}
	return ""
}

// Reply logic
func replyToTweet(authToken, xCsrfToken, bearerToken, tweetText, guestID, tweetID, replyURL string) string {
	body := fmt.Sprintf(`{
		"variables":{
			"tweet_text":"%s\n",
			"reply":{"in_reply_to_tweet_id":"%s","exclude_reply_user_ids":[]},
			"dark_request":false,
			"media":{"media_entities":[],"possibly_sensitive":false},
			"semantic_annotation_ids":[],
			"disallowed_reply_options":null
		},
		"features":{
			"premium_content_api_read_enabled":false,
			"communities_web_enable_tweet_community_results_fetch":true,
			"c9s_tweet_anatomy_moderator_badge_enabled":true,
			"responsive_web_grok_analyze_button_fetch_trends_enabled":false,
			"responsive_web_grok_analyze_post_followups_enabled":true,
			"responsive_web_jetfuel_frame":true,
			"responsive_web_grok_share_attachment_enabled":true,
			"responsive_web_edit_tweet_api_enabled":true,
			"graphql_is_translatable_rweb_tweet_is_translatable_enabled":true,
			"view_counts_everywhere_api_enabled":true,
			"longform_notetweets_consumption_enabled":true,
			"responsive_web_twitter_article_tweet_consumption_enabled":true,
			"tweet_awards_web_tipping_enabled":false,
			"responsive_web_grok_show_grok_translated_post":false,
			"responsive_web_grok_analysis_button_from_backend":true,
			"creator_subscriptions_quote_tweet_preview_enabled":false,
			"longform_notetweets_rich_text_read_enabled":true,
			"longform_notetweets_inline_media_enabled":true,
			"payments_enabled":false,
			"profile_label_improvements_pcf_label_in_post_enabled":true,
			"rweb_tipjar_consumption_enabled":true,
			"verified_phone_label_enabled":false,
			"articles_preview_enabled":true,
			"responsive_web_grok_community_note_auto_translation_is_enabled":false,
			"responsive_web_graphql_skip_user_profile_image_extensions_enabled":false,
			"freedom_of_speech_not_reach_fetch_enabled":true,
			"standardized_nudges_misinfo":true,
			"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled":true,
			"responsive_web_grok_image_annotation_enabled":true,
			"responsive_web_graphql_timeline_navigation_enabled":true,
			"responsive_web_enhance_cards_enabled":false
		},
		"queryId":"F7hteriqzdRzvMfXM6Ul4w"
	}`, tweetText, tweetID)

	headers := map[string]string{
		"Host":                      "x.com",
		"Cookie":                    "auth_token=" + authToken + "; ct0=" + xCsrfToken,
		"Content-Length":            fmt.Sprint(len(body)),
		"Sec-Ch-Ua-Platform":        "\"Linux\"",
		"Authorization":             "Bearer " + bearerToken,
		"X-Csrf-Token":              xCsrfToken,
		"Accept-Language":           "en-US,en;q=0.9",
		"Sec-Ch-Ua":                 "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\"",
		"X-Twitter-Client-Language": "en",
		"Sec-Ch-Ua-Mobile":          "?0",
		"X-Twitter-Active-User":     "yes",
		"X-Client-Transaction-Id":   "PAtpENtMwY12l+8Tw4bvAj6EKHv6EWdZ9GJXlitAHYrL1dhK7KzWEAc93fI8N+iEE0tDBTiVuRJJov+NSnpm5MopwP3UPw",
		"X-Twitter-Auth-Type":       "OAuth2Session",
		"User-Agent":                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
		"Content-Type":              "application/json",
		"X-Xp-Forwarded-For":        get_xpff(guestID),
		"Accept":                    "*/*",
		"Origin":                    "https://x.com",
		"Sec-Fetch-Site":            "same-origin",
		"Sec-Fetch-Mode":            "cors",
		"Sec-Fetch-Dest":            "empty",
		"Referer":                   replyURL, // ✅ Use actual tweet URL
		"Priority":                  "u=1, i",
	}

	return httpRequest("https://x.com/i/api/graphql/F7hteriqzdRzvMfXM6Ul4w/CreateTweet", "POST", []byte(body), headers)
}

func httpRequest(targetUrl string, method string, data []byte, headers map[string]string) string {

	request, error := http.NewRequest(method, targetUrl, bytes.NewBuffer(data))
	for k, v := range headers {
		request.Header.Set(k, v)

	}

	customTransport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Transport: customTransport}
	response, error := client.Do(request)
	defer response.Body.Close()

	if error != nil {
		panic(error)
	}

	body, _ := io.ReadAll(response.Body)
	fmt.Println("response Status:", response.Status)
	return string(body)
}

// Derive XPFF key using SHA256(baseKey + guestID)
func (x *XPFFHeaderGenerator) deriveXPFFKey(guestID string) []byte {
	combined := x.BaseKey + guestID
	hash := sha256.Sum256([]byte(combined))
	return hash[:]
}

// Generate encrypted XPFF string
func (x *XPFFHeaderGenerator) GenerateXPFF(plaintext, guestID string) (string, error) {
	key := x.deriveXPFFKey(guestID)

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, 12)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	ciphertext := aesgcm.Seal(nil, nonce, []byte(plaintext), nil)
	result := append(nonce, ciphertext...)

	return hex.EncodeToString(result), nil
}

// Decrypt XPFF hex string
func (x *XPFFHeaderGenerator) DecodeXPFF(hexString, guestID string) (string, error) {
	key := x.deriveXPFFKey(guestID)

	raw, err := hex.DecodeString(hexString)
	if err != nil {
		return "", err
	}

	if len(raw) < 12 {
		return "", fmt.Errorf("invalid encrypted data")
	}

	nonce := raw[:12]
	ciphertext := raw[12:]

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	plaintext, err := aesgcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

func get_xpff(guestID string) string {
	baseKey := "0e6be1f1e21ffc33590b888fd4dc81b19713e570e805d4e5df80a493c9571a05"
	xpffPlain := `{"navigator_properties":{"hasBeenActive":"true","userAgent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)","webdriver":"false"},"created_at":1750014202073}`

	gen := XPFFHeaderGenerator{BaseKey: baseKey}

	encrypted, err := gen.GenerateXPFF(xpffPlain, guestID)
	if err != nil {
		panic(err)
	}
	fmt.Println("Encrypted:", encrypted)
	return encrypted
}

// GetCT0Cookie opens Twitter/X, injects auth_token, and returns ct0 cookie
func GetCT0Cookie(authToken string) (string, error) {
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", false), // Set to true if you want headless
		chromedp.Flag("disable-gpu", false),
	)

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()

	ctx, cancelCtx := chromedp.NewContext(allocCtx)
	defer cancelCtx()

	// Start Chrome
	if err := chromedp.Run(ctx); err != nil {
		return "", err
	}

	// Enable network
	if err := chromedp.Run(ctx, network.Enable()); err != nil {
		return "", err
	}

	// 1️⃣ Navigate to x.com to get domain context
	if err := chromedp.Run(ctx, chromedp.Navigate("https://x.com")); err != nil {
		return "", err
	}
	time.Sleep(3 * time.Second)

	// 2️⃣ Inject auth_token cookie
	err := chromedp.Run(ctx,
		network.SetCookie("auth_token", authToken).
			WithDomain(".x.com").
			WithPath("/").
			WithHTTPOnly(true).
			WithSecure(true),
	)
	if err != nil {
		return "", err
	}

	// 3️⃣ Reload to apply cookie
	if err := chromedp.Run(ctx, chromedp.Reload()); err != nil {
		return "", err
	}
	time.Sleep(5 * time.Second)

	// 4️⃣ Retrieve cookies
	var cookies []*network.Cookie
	err = chromedp.Run(ctx, chromedp.ActionFunc(func(ctx context.Context) error {
		c, e := network.GetCookies().Do(ctx)
		cookies = c
		return e
	}))
	if err != nil {
		return "", err
	}

	// 5️⃣ Find ct0 cookie
	for _, c := range cookies {
		if c.Name == "ct0" {
			return c.Value, nil
		}
	}

	return "", fmt.Errorf("ct0 cookie not found")
}

// getBearerToken performs the request and extracts the Bearer token
func getBearerToken() (string, error) {
	headers := map[string]string{
		"Host":                     "abs.twimg.com",
		"Cache-Control":            "max-age=0",
		"User-Agent":               "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
		"Accept":                   "*/*",
		"Sec-Fetch-Site":           "cross-site",
		"Sec-Fetch-Mode":           "no-cors",
		"Sec-Fetch-Dest":           "script",
		"Sec-Fetch-Storage-Access": "active",
		"Referer":                  "https://x.com/",
		"Accept-Language":          "en-US,en;q=0.9",
		"Priority":                 "u=0, i",
	}
	url := "https://abs.twimg.com/responsive-web/client-serviceworker/serviceworker.bd07edaa.js"

	// Make HTTP request
	req, err := http.NewRequest("GET", url, bytes.NewBuffer(nil))
	if err != nil {
		return "", err
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	// Convert response to string
	bodyStr := string(body)

	// Find the token between the two markers
	startMarker := `:"Bearer `
	endMarker := `"),Accept:"application/x-www-form-urlencoded`

	startIndex := strings.Index(bodyStr, startMarker)
	if startIndex == -1 {
		return "", fmt.Errorf("Bearer token start marker not found")
	}

	startIndex += len(startMarker)

	endIndex := strings.Index(bodyStr[startIndex:], endMarker)
	if endIndex == -1 {
		return "", fmt.Errorf("Bearer token end marker not found")
	}

	bearerToken := bodyStr[startIndex : startIndex+endIndex]

	return bearerToken, nil
}
