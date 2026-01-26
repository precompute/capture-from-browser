package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type ReceivedData struct {
	SourceURL     string    `json:"source_url"`
	SelectionText string    `json:"selection_text"`
	SelectionHTML string    `json:"selection_html"`
	Context       string    `json:"context"`
	Timestamp     time.Time `json:"timestamp"`
	Markdown      bool      `json:"markdown"`
	PageTitle     string    `json:"page_title"`
	SelectionMD   string    `json:"-"`
	SelectionDWIM string    `json:"-"`
}

type confFlags struct {
	port         string
	outputFile   string
	outputFormat string
}

func captureHandler(writer http.ResponseWriter, req *http.Request, cf confFlags) {
	writer.Header().Set("Access-Control-Allow-Origin", "*")
	writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	writer.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if req.Method == "OPTIONS" {
		return
	}

	if req.Method != "POST" {
		http.Error(writer, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var recdata ReceivedData
	if err := json.NewDecoder(req.Body).Decode(&recdata); err != nil {
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	outString := os.Expand(cf.outputFormat, func(z string) string {
		switch z {
		case "SourceURL":
			return recdata.SourceURL
		case "SelectionText":
			return recdata.SelectionText
		case "SelectionHTML":
			return recdata.SelectionHTML
		case "Context":
			return recdata.Context
		case "Timestamp":
			return recdata.Timestamp.Format("2000-01-01 00:00:00")
		case "PageTitle":
			return recdata.PageTitle
		case "SelectionMD":
			return recdata.SelectionMD
		case "SelectionDWIM":
			if recdata.Markdown {
				return recdata.SelectionHTML
			} else {
				return recdata.SelectionText
			}
		default:
			return ""
		}

	})
	outString = strings.ReplaceAll(outString, "\\n", "\n")

	outfile, err := os.OpenFile(cf.outputFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err == nil {
		defer outfile.Close()
		outfile.WriteString(outString)
	} else {
		log.Println("Couldn't write to file", err)
	}

	writer.WriteHeader(http.StatusOK)
	fmt.Fprint(writer, "Captured Successfully")
}

func main() {
	cf := confFlags{}
	flag.StringVar(&cf.port, "p", "18080", "Port")
	flag.StringVar(&cf.outputFile, "o", "/tmp/capture.txt", "File to print text to")
	flag.StringVar(&cf.outputFormat, "f",
		"\n** $PageTitle\n$SourceURL\n$Timestamp\n#+begin_quote\n$SelectionDWIM\n#+end_quote\n$Context",
		`Output format.  Uses $var for variables.  Allowed variables:
$SourceURL: URL of the captured page
$SelectionText: Selected Text
$SelectionHTML: Selected Text as raw HTML
$Context: User-supplied text
$Timestamp: Capture Time
$PageTitle: Title of captured page
$SelectionMD: Selected HTML converted to Markdown
$SelectionDWIM: Do What I Mean: Markdown if the Markdown flag is set on the server, plain text otherwise.
\n: Newline
`)
	flag.Parse()

	http.HandleFunc("/api/capture", func(w http.ResponseWriter, r *http.Request) {
		captureHandler(w, r, cf)
	})

	fmt.Printf("Capture Server running on http://localhost:%s\n", cf.port)
	log.Fatal(http.ListenAndServe(":"+cf.port, nil))
}
