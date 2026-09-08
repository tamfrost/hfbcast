'use strict'

const API_BASE = '/api/v1/broadcasts'

const queryTypeSelect = document.getElementById('queryType')
const searchBtn = document.getElementById('searchBtn')
const statusEl = document.getElementById('status')
const tbody = document.querySelector('#resultsTable tbody')

// API inspector elements
const reqMethodEl = document.getElementById('reqMethod')
const reqUrlEl = document.getElementById('reqUrl')
const reqCurlEl = document.getElementById('reqCurl')
const resStatusEl = document.getElementById('resStatus')
const resJsonEl = document.getElementById('resJson')
const copyReqBtn = document.getElementById('copyReqBtn')
const copyResBtn = document.getElementById('copyResBtn')

let lastResponseText = ''
let lastRows = []              // cached result set for client-side re-sorting
let clientSortKey = null       // active header sort key, or null
let clientSortDir = 'asc'      // 'asc' | 'desc'

const inspectorEl = document.getElementById('inspector')
const resultsHead = document.querySelector('#resultsTable thead')

const inputGroups = document.querySelectorAll('#inputs [data-input]')
const sortBySelect = document.getElementById('sortBy')
const sortDirSelect = document.getElementById('sortDir')

// Show/hide inputs based on the selected query type
function updateInputs() {
    const type = queryTypeSelect.value
    inputGroups.forEach(group => {
        group.style.display = group.dataset.input === type ? '' : 'none'
    })
}

queryTypeSelect.addEventListener('change', updateInputs)

function setStatus(message, isError) {
    statusEl.textContent = message || ''
    statusEl.className = 'status' + (isError ? ' error' : (message ? ' info' : ''))
}

function clearTable() {
    tbody.innerHTML = ''
}

/**
 * Updates the visual state of sortable headers: removes arrows and the
 * active class from all headers, then applies them to the active one.
 */
function updateHeaderIndicators() {
    resultsHead.querySelectorAll('th[data-sort]').forEach(th => {
        th.classList.remove('sort-active')
        const arrow = th.querySelector('.sort-arrow')
        if (arrow) arrow.remove()
    })
    if (clientSortKey) {
        const activeTh = resultsHead.querySelector(`th[data-sort="${clientSortKey}"]`)
        if (activeTh) {
            activeTh.classList.add('sort-active')
            const span = document.createElement('span')
            span.className = 'sort-arrow'
            span.textContent = clientSortDir === 'asc' ? '▲' : '▼'
            activeTh.appendChild(span)
        }
    }
}

/**
 * Sorts the cached `lastRows` array in place by `key`/`dir` and re-renders.
 * Toggles direction when the same header is clicked again.
 */
function sortByHeader(key) {
    if (clientSortKey === key) {
        clientSortDir = clientSortDir === 'asc' ? 'desc' : 'asc'
    } else {
        clientSortKey = key
        clientSortDir = 'asc'
    }

    lastRows.sort((a, b) => {
        const va = a[key]
        const vb = b[key]
        if (va === null || va === undefined) return 1
        if (vb === null || vb === undefined) return -1
        if (typeof va === 'number' && typeof vb === 'number') {
            return clientSortDir === 'asc' ? va - vb : vb - va
        }
        const cmp = String(va).localeCompare(String(vb))
        return clientSortDir === 'asc' ? cmp : -cmp
    })

    clearTable()
    renderRows(lastRows)
    updateHeaderIndicators()
}

// Wire up click handlers on sortable headers
resultsHead.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        if (lastRows.length > 0) {
            sortByHeader(th.dataset.sort)
        }
    })
})

// Escape HTML to avoid injection from DB text fields
function esc(value) {
    if (value === null || value === undefined) return ''
    const div = document.createElement('div')
    div.textContent = String(value)
    return div.innerHTML
}

function cell(value) {
    return `<td>${esc(value)}</td>`
}

function renderRows(rows) {
    if (!rows || rows.length === 0) {
        setStatus('No results found', false)
        return
    }

    const frag = document.createDocumentFragment()
    rows.forEach(row => {
        const tr = document.createElement('tr')
        tr.innerHTML =
            cell(row.station) +
            cell(row.country) +
            cell(row.language) +
            `<td>${row.frequency ?? ''}</td>` +
            `<td>${row.days ?? ''}</td>` +
            `<td>${row.startTime ?? ''}</td>` +
            `<td>${row.endTime ?? ''}</td>` +
            cell(row.name) +
            `<td>${row.power ?? ''}</td>` +
            `<td>${row.lat ?? ''}</td>` +
            `<td>${row.lon ?? ''}</td>` +
            cell(row.source)
        frag.appendChild(tr)
    })
    tbody.appendChild(frag)
    setStatus(`${rows.length} result${rows.length === 1 ? '' : 's'} found`, false)
}

async function runQuery() {
    const type = queryTypeSelect.value
    let url = API_BASE

    if (type === 'site') {
        const siteId = document.getElementById('siteId').value
        if (!siteId) {
            setStatus('Please enter a site ID', true)
            return
        }
        url += `/site/${encodeURIComponent(siteId)}`
    } else if (type === 'frequency') {
        const freq = document.getElementById('frequency').value
        if (!freq) {
            setStatus('Please enter a frequency', true)
            return
        }
        url += `/frequency/${encodeURIComponent(freq)}`
    } else if (type === 'range') {
        const min = document.getElementById('minFreq').value
        const max = document.getElementById('maxFreq').value
        if (!min || !max) {
            setStatus('Please enter both min and max frequency', true)
            return
        }
        url += `/frequency-range?min=${encodeURIComponent(min)}&max=${encodeURIComponent(max)}`
    } else if (type === 'around') {
        const freq = document.getElementById('aroundFreq').value
        if (!freq) {
            setStatus('Please enter a frequency', true)
            return
        }
        const df = document.getElementById('aroundDf').value
        url += `/frequency-around/${encodeURIComponent(freq)}`
        if (df) {
            url += `?df=${encodeURIComponent(df)}`
        }
    } else if (type === 'name') {
        const q = document.getElementById('stationName').value
        if (!q) {
            setStatus('Please enter a station name', true)
            return
        }
        url += `/name?q=${encodeURIComponent(q)}`
    }

    // Append optional sort parameters, joining correctly whether or not
    // the URL already contains a query string.
    const sortBy = sortBySelect.value
    const sortDir = sortDirSelect.value
    if (sortBy) {
        url += (url.includes('?') ? '&' : '?') +
            `sortBy=${encodeURIComponent(sortBy)}&sortDir=${encodeURIComponent(sortDir)}`
    }

    clearTable()
    setStatus('Loading...', false)

    // Reset client-side sort state for the new result set. The active header
    // is derived from the server-applied sort (dropdowns), so the arrow
    // indicator matches what the server actually ordered by.
    lastRows = []
    clientSortKey = sortBy || null
    clientSortDir = sortDir
    updateHeaderIndicators()

    // Show the inspector and update the API request view
    inspectorEl.hidden = false
    const fullUrl = window.location.origin + url
    reqMethodEl.textContent = 'GET'
    reqUrlEl.textContent = fullUrl
    reqCurlEl.textContent = `curl -s "${fullUrl}"`

    try {
        const response = await fetch(url)
        const responseText = await response.text()
        lastResponseText = responseText

        let data
        try {
            data = JSON.parse(responseText)
        } catch {
            setStatus('Received invalid JSON from server', true)
            resStatusEl.textContent = `HTTP ${response.status}`
            resStatusEl.className = 'status-badge status-err'
            resJsonEl.textContent = responseText
            return
        }

        // Update the API response inspector
        resStatusEl.textContent = `HTTP ${response.status}`
        resStatusEl.className = 'status-badge ' + (response.ok ? 'status-ok' : 'status-err')
        resJsonEl.textContent = JSON.stringify(data, null, 2)

        if (!response.ok) {
            const message = (data && data.error) ? data.error : `Request failed (${response.status})`
            setStatus(message, true)
            return
        }

        // Cache the result set so headers can re-sort client-side without
        // another network request.
        lastRows = data
        renderRows(data)
    } catch (err) {
        setStatus(`Request failed: ${err.message}`, true)
        resStatusEl.textContent = 'Error'
        resStatusEl.className = 'status-badge status-err'
        resJsonEl.textContent = err.message
    }
}

// Copy-to-clipboard helpers for the inspector
async function copyText(text, btn) {
    try {
        await navigator.clipboard.writeText(text)
        const original = btn.textContent
        btn.textContent = 'Copied!'
        setTimeout(() => { btn.textContent = original }, 1500)
    } catch {
        btn.textContent = 'Copy failed'
    }
}

copyReqBtn.addEventListener('click', () => copyText(reqCurlEl.textContent, copyReqBtn))
copyResBtn.addEventListener('click', () => copyText(lastResponseText, copyResBtn))

searchBtn.addEventListener('click', runQuery)

// allow Enter key in inputs to trigger search
document.querySelectorAll('#inputs input').forEach(input => {
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') runQuery()
    })
})

// Fetch and display database build info in the header
async function loadBuildInfo() {
    const el = document.getElementById('buildInfo')
    try {
        const response = await fetch(`${API_BASE}/buildinfo`)
        const data = await response.json()
        if (response.ok && Array.isArray(data) && data.length > 0) {
            const info = data[0]
            const buildDate = info.buildDate
                ? new Date(info.buildDate).toLocaleString()
                : 'unknown'
            const commitHash = info.commitHash || 'unknown'
            el.textContent = `Database build: ${buildDate} (commit: ${commitHash})`
        } else {
            el.textContent = 'Database build info unavailable'
        }
    } catch {
        el.textContent = 'Database build info unavailable'
    }
}

// initialize view
updateInputs()
loadBuildInfo()
