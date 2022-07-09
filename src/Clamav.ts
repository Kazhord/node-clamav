import Clamscan from './Clamscan'
import ClamavOptions from './interface/ClamavOptions'
import net from 'net'
import Result from './model/Result'
import Ping from './model/Ping'
import Version from './model/Version'
import Reload from './model/Reload'
import Stats from './model/Stats'

export default class Clamav {
    private _options: ClamavOptions
    private _scanner: Clamscan

    constructor(options: ClamavOptions) {
        this._scanner = new Clamscan(this)
        this._options = options
    }

    public async version(timeout = 180000): Promise<Version> {
        return this.processVersion((await this.command('zVERSION\0', timeout)).toString('utf-8'))
    }

    public async stats(timeout = 180000): Promise<Stats> {
        return this.processStats((await this.command('zSTATS\0', timeout)).toString('utf-8'))
    }

    public async ping(timeout = 180000): Promise<Ping> {
        const start = Date.now()
        const pong = await this.command('zPING\0', timeout)
        const end = Date.now()
        return {
            alive: pong.equals(Buffer.from('PONG\0')),
            latency: end - start,
        }
    }

    public async reload(timeout = 180000): Promise<Reload> {
        const reload = await this.command('zRELOAD\0', timeout)
        return {
            reloading: reload.equals(Buffer.from('RELOADING\0')),
        }
    }

    public isCleanReply(reply: Result): boolean {
        return reply.raw.includes('OK') && !reply.raw.includes('FOUND')
    }

    private async command(command: string, timeout: number): Promise<Buffer> {
        const host = this._options.host
        const port = this._options.port
        return new Promise((resolve, reject) => {
            const client = net.createConnection(
                {
                    host,
                    port,
                },
                () => {
                    client.write(command)
                }
            )
            client.setTimeout(timeout)
            const replys: Buffer[] = []
            client
                .on('data', (chunk) => {
                    replys.push(chunk)
                })
                .on('end', () => {
                    resolve(Buffer.concat(replys))
                })
                .on('error', reject)
        })
    }

    private processVersion(version: string): Version {
        const split = version.split('/')
        return {
            product: split[0],
            build: Number(split[1]),
            date: new Date(split[2]),
        }
    }

    private processStats(stats: string): Stats {
        const split = stats.split('\n')
        let pools = -1
        let state = ''
        let threads = ''
        let queue = -1
        let memstats = ''
        for (const line of split) {
            if (line.startsWith('POOLS:')) {
                pools = Number(line.replace('POOLS: ', ''))
            } else if (line.startsWith('STATE:')) {
                state = line.replace('STATE: ', '')
            } else if (line.startsWith('THREADS:')) {
                threads = line.replace('THREADS: ', '')
            } else if (line.startsWith('QUEUE:')) {
                queue = Number(line.replace('QUEUE: ', '').split(' ')[0])
            } else if (line.startsWith('MEMSTATS:')) {
                memstats = line.replace('MEMSTATS: ', '')
            }
        }
        return {
            pools,
            state,
            threads,
            queue,
            memstats,
        }
    }

    public get options(): ClamavOptions {
        return this._options
    }

    public get scanner(): Clamscan {
        return this._scanner
    }
}
