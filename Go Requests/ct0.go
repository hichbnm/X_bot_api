package main

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"strings"
)

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

func main() {
	token, err := getBearerToken()
	if err != nil {
		fmt.Println("❌ Error:", err)
		return
	}

	fmt.Println("✅ Bearer Token:", token)
}
