# @kazhord/node-clamav
Heavily inspired from [kylefarris/clamscan](https://github.com/kylefarris/clamscan) and [NingLin-P/clamdjs](https://github.com/NingLin-P/clamdjs). Made to match my project needs.


## Installation
```sh
$ npm install @kazhord/node-clamav
```

## Features
- Get ClamAV version
- Get ClamAV stats
- Update ClamAV
- Check ClamAV state
- Scan `Stream` and `Buffer`

## To do
- Add tests
- Add comments

## API
```js
import { Clamav } from '@kazhord/node-clamav'
[...]
const clamav = new Clamav({ host: '127.0.0.1', port: 3310 })
```

### Get ClamAV version
```js
await clamav.version([timeout=180000])
/*
{
  product: 'ClamAV 0.104.3',
  build: 26596,
  date: 2022-07-07T05:53:54.000Z
}
*/
```

### Get ClamAV stats
```js
await clamav.stats([timeout=180000])
/*
{
  pools: 1,
  state: 'VALID PRIMARY',
  threads: 'live 1  idle 0 max 10 idle-timeout 30',
  queue: 0,
  memstats: 'heap N/A mmap N/A used N/A free N/A releasable N/A pools 1 pools_used 1267.845M pools_total 1267.894M'
}
*/
```

### Update ClamAV
```js
await clamav.reload([timeout=180000])
/*
{
  reloading: true
}
*/
```

### Get ClamAV state
```js
await clamav.ping([timeout=180000])
/*
{ 
  alive: true, 
  latency: 4 
}
*/
```

### Scan `Stream`
```js
await clamav.scanner.scanStream(stream, [timeout=180000])
/*
{
  isInfected: false,
  viruses: [],
  raw: 'stream: OK\x00',
  timeout: false
}
*/
```

### Scan `Buffer`
```js
await clamav.scanner.scanBuffer(buffer, [chunkSize=64*1024], [timeout=180000])
/*
{
  isInfected: false,
  viruses: [],
  raw: 'stream: OK\x00',
  timeout: false
}
*/
```