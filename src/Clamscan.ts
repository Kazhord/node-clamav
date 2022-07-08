import Clamav from './Clamav'
import net from 'net'
import { Readable, Transform } from 'stream'
import Result from './model/Result'

export default class Clamscan {
    private _clamav: Clamav

    constructor(clamav: Clamav) {
        this._clamav = clamav
    }

    public async scanStream(readStream: Readable, timeout = 180000): Promise<Result> {
        const host = this._clamav.options.host
        const port = this._clamav.options.port
        return new Promise((resolve, reject) => {
            let readFinished = false

            const socket = net.createConnection(
                {
                    host,
                    port,
                },
                () => {
                    socket.write('zINSTREAM\0')
                    // format the chunk
                    readStream.pipe(this.chunkTransform()).pipe(socket)
                    readStream
                        .on('end', () => {
                            readFinished = true
                            readStream.destroy()
                        })
                        .on('error', reject)
                }
            )

            const replys: Buffer[] = []
            socket.setTimeout(timeout)
            socket
                .on('data', (chunk) => {
                    clearTimeout(connectAttemptTimer)
                    if (!readStream.isPaused()) {
                        readStream.pause()
                    }
                    replys.push(chunk)
                })
                .on('end', () => {
                    clearTimeout(connectAttemptTimer)
                    const reply = Buffer.concat(replys)
                    if (!readFinished) {
                        reject(new Error('Scan aborted. Reply from server: ' + reply))
                    } else {
                        resolve(this.processResult(reply.toString('utf8')))
                    }
                })
                .on('error', reject)

            const connectAttemptTimer = setTimeout(() => {
                socket.destroy(new Error('Timeout connecting to server'))
            }, timeout)
        })
    }

    public scanBuffer(buffer: Buffer, chunkSize = 64 * 1024, timeout = 180000): Promise<Result> {
        let start = 0
        const bufReader = new Readable({
            highWaterMark: chunkSize,
            read(size) {
                if (start < buffer.length) {
                    const block = buffer.slice(start, start + size)
                    this.push(block)
                    start += block.length
                } else {
                    this.push(null)
                }
            },
        })
        return this.scanStream(bufReader, timeout)
    }

    private chunkTransform(): Transform {
        return new Transform({
            transform(chunk, _, callback) {
                const length = Buffer.alloc(4)
                length.writeUInt32BE(chunk.length, 0)
                this.push(length)
                this.push(chunk)
                callback()
            },

            flush(callback) {
                const zore = Buffer.alloc(4)
                zore.writeUInt32BE(0, 0)
                this.push(zore)
                callback()
            },
        })
    }

    private processResult(result: string): Result {
        // Clean up the result string so that its predictably parseable
        result = result.trim()
        let timeout = false
        let isInfected = false
        let viruses: string[] = []

        // If the result string looks like 'Anything Here: SOME VIRUS FOUND\n', the file is infected
        // eslint-disable-next-line no-control-regex
        if (/:\s+(.+)FOUND(\u0000|[\r\n])?/gm.test(result)) {
            // Parse out the name of the virus(es) found...
            viruses = result
                // eslint-disable-next-line no-control-regex
                .split(/(\u0000|[\r\n])/)
                .map((v) =>
                    /:\s+(.+)FOUND$/gm.test(v)
                        ? v.replace(/(.+:\s+)(.+)FOUND/gm, '$2').trim()
                        : null
                )
                .filter((v) => !!v)
            isInfected = true
        }

        // If the result of the scan ends with "ERROR", there was an error (file permissions maybe)
        // eslint-disable-next-line no-control-regex
        if (/^(.+)ERROR(\u0000|[\r\n])?/gm.test(result)) {
            const error = result.replace(/^(.+)ERROR/gm, '$1').trim()
            throw new Error(`An error occurred while scanning the piped-through stream: ${error}`)
        }

        // This will occur in the event of a timeout (rare)
        if (result === 'COMMAND READ TIMED OUT') {
            timeout = true
        }

        return { isInfected, viruses, raw: result, timeout }
    }
}
