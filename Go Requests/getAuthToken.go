package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"
)

func main() {
	// Launch Chrome with GUI (not headless)
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", false),
		chromedp.Flag("disable-gpu", false),
	)

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()

	ctx, cancelCtx := chromedp.NewContext(allocCtx)
	defer cancelCtx()

	// Start Chrome
	if err := chromedp.Run(ctx); err != nil {
		panic(err)
	}

	// Enable network
	if err := chromedp.Run(ctx, network.Enable()); err != nil {
		panic(err)
	}

	fmt.Println("🚀 Opening Twitter login page... Please log in manually.")

	// Navigate to Twitter login page
	if err := chromedp.Run(ctx, chromedp.Navigate("https://x.com/login")); err != nil {
		panic(err)
	}

	fmt.Println("⏳ Waiting for auth_token and guest_id cookies after login...")

	var authToken, guestID string

	for {
		time.Sleep(3 * time.Second) // wait 3s between checks

		var cookies []*network.Cookie
		err := chromedp.Run(ctx, chromedp.ActionFunc(func(ctx context.Context) error {
			c, e := network.GetCookies().Do(ctx)
			cookies = c
			return e
		}))
		if err != nil {
			fmt.Println("⚠️ Error getting cookies:", err)
			continue
		}

		for _, c := range cookies {
			if c.Name == "auth_token" && authToken == "" {
				authToken = c.Value
			}
			if c.Name == "guest_id" && guestID == "" {
				guestID = c.Value
			}
		}

		if authToken != "" && guestID != "" {
			fmt.Println("✅ Auth Token Retrieved:", authToken)
			fmt.Println("✅ Guest ID Retrieved:", guestID)
			break
		}
	}

	// Save auth_token to file
	if err := os.WriteFile("auth_token.txt", []byte(authToken), 0644); err != nil {
		panic(err)
	}
	fmt.Println("💾 Auth token saved to auth_token.txt")

	// Save guest_id to file
	if err := os.WriteFile("guest_id.txt", []byte(guestID), 0644); err != nil {
		panic(err)
	}
	fmt.Println("💾 Guest ID saved to guest_id.txt")
}
