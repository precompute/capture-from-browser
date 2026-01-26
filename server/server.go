package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

type Payload struct {
	SourceURL     string    `json:"source_url"`
	SelectionText string    `json:"selection_text"`
	SelectionHTML string    `json:"selection_html"`
	Context       string    `json:"context"`
	Timestamp     time.Time `json:"timestamp"`
	Markdown      bool      `json:"markdown"`
	PageTitle     string    `json:"page_title"`
}

func captureHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		return // Preflight request successful
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var p Payload
	err := json.NewDecoder(r.Body).Decode(&p)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	fmt.Println("------------------------------------------------")
	fmt.Printf("Received at: %s\n", p.Timestamp.Format(time.RFC822))
	fmt.Printf("URL: %s\n", p.SourceURL)
	fmt.Printf("Title: %s\n", p.PageTitle)
	fmt.Printf("Context: %s\n", p.Context)
	fmt.Printf("Markdown: %v\n", p.Markdown)
	fmt.Printf("Text Snippet: %s\n", p.SelectionText)
	fmt.Printf("HTML Snippet: %s\n", p.SelectionHTML)
	fmt.Println("------------------------------------------------")
}

func main() {
	args := os.Args
	port := ":18080"
	if len(args) == 2 {
		port = ":" + args[1]
	}
	http.HandleFunc("/api/capture", captureHandler)
	fmt.Println("Capture Server running on http://localhost" + port)
	log.Fatal(http.ListenAndServe(port, nil))
}
