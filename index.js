const irc = require('irc')
const DCC = require('irc-dcc');
const fs = require('fs')

let lines = process.stdout.rows
let terminalWidth = process.stdout.columns
let currentRenderOption = ""
let currentOptions = []
let currentPage = 0
let numPages = 0
let renderHeight = 0
let choice = null
let errMessage = null
let statusLine = ""
let messageLine = ""

let pendingFileNames = []

const AdmZip = require('adm-zip')

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

let truncate = (str) => {

            if(str.length >= terminalWidth) {
                process.stdout.write(str.substr(0, terminalWidth - 5) + "...\n")
            } else process.stdout.write(str)
}
function makeid(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

const user = `booklover${makeid(Math.floor((Math.random() * 5) + 2))}`
console.log(`Connecting as ${user}`)

let searching = false
let query = ""
let filename = ""
const client = new irc.Client( 'irc.irchighway.net', user, {
    channels: ["#ebooks"],
    port: 6660
})

const dcc = new DCC(client)

// client.addListener('message', (from, to, msg) => {
//             console.log(`${from} -| ${msg}`)

    
// })

// client.addListener('pm',  (from, message) => {
//     if(searching) {
//         console.log(from + ' => ME: ' + message);
//     }
// });

client.addListener("registered", (msg) => {
    console.log("Registered")
    client.join("#ebooks")
})

client.addListener('notice', (nick, to, text, message) => {
    if(currentRenderOption !== "options") {
        console.log(text)
    } else {
        messageLine = text
        render()
    }

    if(text.trim().toLowerCase().includes("sorry")) {
        searching = false
        readyForQuery = true
        errMessage = "No books found for query."
        startQuery() 
    }
})

let joined = false
let readyForQuery = false
let prompted = false
client.on('join#ebooks', (nick, msg) => {
    
    if(!joined) {
        console.log("Joined ebooks channel")
        readyForQuery = true
        setTimeout(startQuery, 500)
    }
    joined = true


   
    
})

const startQuery = () => {
     if(readyForQuery) {
        prompted = true
        console.log('\x1Bc');
        if(errMessage) {
            console.log(errMessage)
            errMessage = null
        }
        readyForQuery = false
        readline.clearLine(process.stdout, 0)
        readline.question("Search for a book (enter nothing to quit) | ", (q) => {
            if(q.length == 0) {
                process.exit(0)
            }
            searching = true
            prompted = false
            pendingFileNames = []
            client.say("#ebooks", `@search ${q}`)
            console.log(`@search ${q}`)
            query = q
        })
    }
}

client.on('dcc-send', (from, args, message) => {
    dcc.acceptFile(from, args.host, args.port, 'test.zip', null, (x, f, conn) => {
        let buf = Buffer.alloc(4)

     
        let data = []

        conn.on("data", (d) => {
            data.push(d)
        })

        conn.on("close", () => {
            if(searching) {
                // TODO: I know GZIP is able to take in buffers, but it is throwing an incorrect header error
                //       I got around this by creating a file and using the read stream instead
                const file = Buffer.concat(data)
                const zip = new AdmZip(file)

                let options = ""
                zip.getEntries().forEach(entry => {
                    if(entry.entryName.includes(".txt")) {
                        options += entry.getData().toString('utf8')
                    }
                })

                currentOptions = options.split("\n").slice(6)
                currentOptions.pop()

                currentRenderOption = "options"
                searching = false
                render()
                // readline.question("Copy and paste your choice (empty response for none) | ", (choice) => {
                //     if(choice.length == 0) {
                //         readyForQuery = true
                //     } else {
                //         filename =  choice.split('  ')[0].substr(1)
                //         console.log("Retrieving ", filename.trim(),".")
                //         client.say("#ebooks", choice)
                //     }
                // })

                
            } else {
                if(pendingFileNames.length > 0) {
                    // * Given file
                    // console.log("Saving file...")
                    const file = Buffer.concat(data)
                    let fileName = pendingFileNames[0]
                    pendingFileNames.shift()
                    fs.writeFileSync(fileName.trim(), file)
                    if(currentRenderOption === "options")
                        render()
                }
            }



        })
    })
})
// client.join("#ebooks")






let render = () => {
    if(currentRenderOption === "options") {
        
        if(choice != null) {
            let bookChoice = currentOptions[(currentPage * renderHeight) + parseInt(choice)]
            filename =  bookChoice.split('  ')[0].substr(1)
            statusLine = "Sent Request for " + filename 
            choice = null

            client.say("#ebooks", bookChoice)
            pendingFileNames.push(filename)
        }
        renderHeight = Math.min(lines - 5, 10)
        numPages = Math.ceil(currentOptions.length / renderHeight)
        let linesToRender = Math.min(currentOptions.length - (currentPage * renderHeight) , renderHeight)
        console.log('\x1Bc');         
        truncate(`Pick your option. Press the key corresponding to the choice (Page ${currentPage + 1} of ${numPages})\n`)
        truncate("Press = to go up a page, Press - to go down a page, Press q to quit\n")
        truncate(statusLine + "\n")
        truncate(`Pending file downloads: ${pendingFileNames.length} \n`)
        truncate(messageLine + "\n")

        for(let i = currentPage * renderHeight; i < (currentPage * renderHeight) + linesToRender; i++) {
            let line = ` ${(i % renderHeight).toString()}: ${currentOptions[i]}\n`
            truncate(line)
        }

        return
    } 

    statusLine = ""
}

process.stdin.on('keypress', (ch, key) => {
    switch(ch) {
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '9':
        case '9':
        case '0':
            if(parseInt(key.name) < renderHeight) {
                choice = key.name
            } else {
                return
            }
            break
        case '-':
            if(currentPage > 0) {
                currentPage--
            }
            break
        case '=':
            if(currentPage < numPages - 1) {
                currentPage++
            } 
            break
        case 'q':
            if(prompted) {
                return
            }
            if(readyForQuery == false) {
                searching = false
                readyForQuery = true
                startQuery()
            }

            currentOptions = []
            return
        default:
            return
    }
    render()

})


process.stdout.on('resize', () => {
    lines = process.stdout.rows
    terminalWidth = process.stdout.columns
    render()

})

