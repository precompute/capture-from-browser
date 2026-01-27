package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
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
}

type confFlags struct {
	port                 string
	outputFile           string
	outputFormat         string
	outputFormatMarkdown string
}

func htmlToMD(htmlInput string, fallback string) string {
	_, err := exec.LookPath("pandoc")
	if err == nil {
		cmd := exec.Command("pandoc", "-f", "html-native_divs-native_spans",
			"-t", "markdown-raw_html+backtick_code_blocks-native_divs-native_spans+pipe_tables",
			"--wrap=none")
		cmd.Stdin = strings.NewReader(htmlInput)
		out, err := cmd.Output()
		if err == nil {
			return string(out)
		} else {
			log.Printf("Pandoc Error: %v", err)
			return fallback
		}
	} else {
		log.Printf("Could not find Pandoc: %v", err)
		return fallback
	}
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

	format := ""
	if recdata.Markdown && cf.outputFormatMarkdown != "" {
		format = cf.outputFormatMarkdown
	} else {
		format = cf.outputFormat
	}

	var formatMap func(string) string
	formatMap = func(z string) string {
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
			return recdata.Timestamp.Local().Format("[06-01-02 15:04:05]")
		case "PageTitle":
			return recdata.PageTitle
		case "SelectionMD":
			return htmlToMD(recdata.SelectionHTML, recdata.SelectionText)
		case "SelectionDWIM":
			if recdata.Markdown {
				return formatMap("SelectionMD")
			} else {
				return formatMap("SelectionText")
			}
		case "SelectionTextBlock":
			return "\n#+begin_quote\n" + formatMap("SelectionText") + "\n#+end_quote"
		case "SelectionMdBlock":
			return "\n#+begin_src markdown\n" + formatMap("SelectionText") + "\n#+end_src"
		case "SelectionDWIMBlock":
			if recdata.Markdown {
				return formatMap("SelectionMDBlock")
			} else {
				return formatMap("SelectionText")
			}
		default:
			return ""
		}
	}
	outString := os.Expand(format, formatMap)
	outString = strings.ReplaceAll(outString, "\\n", "\n")

	outfile, err := os.OpenFile(cf.outputFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err == nil {
		defer outfile.Close()
		outfile.WriteString(outString)
		// log.Printf("Timestamp %s\n%s", recdata.Timestamp.Local(), outString)
	} else {
		log.Println("Couldn't write to file", err)
	}

	writer.WriteHeader(http.StatusOK)
}

func main() {
	cf := confFlags{}
	flag.StringVar(&cf.port, "p", "18080", "Port")
	flag.StringVar(&cf.outputFile, "o", "/tmp/capture.txt", "File to print text to")
	flag.StringVar(&cf.outputFormat, "f",
		"\n** ${PageTitle}\n${SourceURL}\n${Timestamp}\n#+begin_quote\n${SelectionDWIM}\n#+end_quote\n${Context}",
		`Output format.  Uses $var for variables.  Allowed variables:
$SourceURL: URL of the captured page
$SelectionText: Selected Text
$SelectionHTML: Selected Text as raw HTML
$Context: User-supplied text
$Timestamp: Capture Time
$PageTitle: Title of captured page
$SelectionMD: Selected HTML converted to Markdown
$SelectionDWIM: Do What I Mean: Markdown if the Markdown flag is set on the server, plain text otherwise.
$SelectionTextBlock: Same as SelectionText, but with org-mode blocks.
$SelectionMDBlock: Same as SelectionMD, but with org-mode blocks.
$SelectionDWIMBlock: Same as SelectionDWIM, but with org-mode blocks.
\n: Newline
`)
	flag.StringVar(&cf.outputFormatMarkdown, "m", "", "Same as -f, but for markdown (if present).")
	flag.Parse()

	http.HandleFunc("/api/capture", func(w http.ResponseWriter, r *http.Request) {
		captureHandler(w, r, cf)
	})

	fmt.Printf("Capture Server running on http://localhost:%s\n", cf.port)
	log.Fatal(http.ListenAndServe(":"+cf.port, nil))
}
