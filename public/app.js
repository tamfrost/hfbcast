'use strict'

const API_BASE = '/api/v1/broadcasts'

// Number of rows rendered per page. Rendering all ~3.6k broadcasts at once
// creates ~43k <td> nodes and causes significant layout/paint lag, so we
// render one page at a time from the cached `lastRows` set.
const PAGE_SIZE = 50

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
let currentPage = 0            // zero-based index of the visible page

const inspectorEl = document.getElementById('inspector')
const resultsHead = document.querySelector('#resultsTable thead')
const pagerEl = document.getElementById('pager')      // pagination controls container
const responseDetails = document.getElementById('responseDetails')

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

    currentPage = 0
    clearTable()
    renderCurrentPage()
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

// Escape HTML to avoid injection from DB text fields.
// A single reusable element avoids allocating thousands of <div> nodes when
// rendering large result sets.
const escaper = document.createElement('div')
function esc(value) {
    if (value === null || value === undefined) return ''
    escaper.textContent = String(value)
    return escaper.innerHTML
}

function cell(value) {
    return `<td>${esc(value)}</td>`
}

/**
 * Renders the page of `lastRows` indicated by `currentPage`.
 * Only PAGE_SIZE rows are turned into DOM nodes at a time, which keeps
 * layout and paint work small even for multi-thousand-row result sets.
 */
function renderCurrentPage() {
    if (!lastRows || lastRows.length === 0) {
        renderPager()
        setStatus('No results found', false)
        return
    }

    const start = currentPage * PAGE_SIZE
    const pageRows = lastRows.slice(start, start + PAGE_SIZE)

    const frag = document.createDocumentFragment()
    pageRows.forEach(row => {
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

    renderPager()
    const first = start + 1
    const last = Math.min(start + PAGE_SIZE, lastRows.length)
    setStatus(`${lastRows.length} result${lastRows.length === 1 ? '' : 's'} found (showing ${first}–${last})`, false)
}

/**
 * Builds or refreshes the pagination controls below the table.
 */
function renderPager() {
    pagerEl.innerHTML = ''
    if (!lastRows || lastRows.length <= PAGE_SIZE) {
        return
    }

    const totalPages = Math.ceil(lastRows.length / PAGE_SIZE)
    const makeBtn = (label, page, disabled, ariaLabel) => {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'page-btn'
        btn.textContent = label
        btn.setAttribute('aria-label', ariaLabel)
        if (disabled) {
            btn.disabled = true
        } else {
            btn.addEventListener('click', () => goToPage(page))
        }
        return btn
    }

    pagerEl.appendChild(makeBtn('⏮ First', 0, currentPage === 0, 'First page'))
    pagerEl.appendChild(makeBtn('‹ Prev', currentPage - 1, currentPage === 0, 'Previous page'))

    // Page number buttons: show a windowed range around the current page so
    // we don't render hundreds of buttons for very large result sets.
    const windowSize = 5
    let from = Math.max(0, currentPage - Math.floor(windowSize / 2))
    const to = Math.min(totalPages, from + windowSize)
    from = Math.max(0, to - windowSize)
    for (let p = from; p < to; p++) {
        const btn = makeBtn(String(p + 1), p, false, `Go to page ${p + 1}`)
        if (p === currentPage) btn.classList.add('page-active')
        pagerEl.appendChild(btn)
    }

    pagerEl.appendChild(makeBtn('Next ›', currentPage + 1, currentPage >= totalPages - 1, 'Next page'))
    pagerEl.appendChild(makeBtn('Last ⏭', totalPages - 1, currentPage >= totalPages - 1, 'Last page'))
}

/**
 * Switches to a new page and re-renders the table body.
 */
function goToPage(page) {
    const totalPages = Math.ceil(lastRows.length / PAGE_SIZE)
    if (page < 0 || page >= totalPages) return
    currentPage = page
    clearTable()
    renderCurrentPage()
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
    pagerEl.innerHTML = ''
    setStatus('Loading...', false)

    // Reset client-side sort state for the new result set. The active header
    // is derived from the server-applied sort (dropdowns), so the arrow
    // indicator matches what the server actually ordered by.
    lastRows = []
    currentPage = 0
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

        // Update the API response inspector status. The full JSON body is
        // pretty-printed lazily only when the user expands the response
        // panel — stringify-ing 3.6k rows up front is expensive and the
        // panel is collapsed by default.
        resStatusEl.textContent = `HTTP ${response.status}`
        resStatusEl.className = 'status-badge ' + (response.ok ? 'status-ok' : 'status-err')
        stashInspectorJson(data)

        if (!response.ok) {
            const message = (data && data.error) ? data.error : `Request failed (${response.status})`
            setStatus(message, true)
            return
        }

        // Cache the result set so headers can re-sort client-side without
        // another network request.
        lastRows = data
        renderCurrentPage()
    } catch (err) {
        setStatus(`Request failed: ${err.message}`, true)
        resStatusEl.textContent = 'Error'
        resStatusEl.className = 'status-badge status-err'
        resJsonEl.textContent = err.message
    }
}

/**
 * Stashes the parsed response data so it can be pretty-printed into the
 * inspector on demand. The JSON.stringify call and the DOM text assignment
 * are both deferred until the response <details> panel is actually expanded,
 * avoiding a large synchronous string build and layout pass for content the
 * user isn't looking at.
 */
let pendingInspectorData = null
function stashInspectorJson(data) {
    pendingInspectorData = data
    resJsonEl.textContent = ''
    if (responseDetails.open) {
        flushInspectorJson()
    } else {
        responseDetails.dataset.rendered = '0'
    }
}

// When the response panel is expanded, materialise any deferred JSON.
responseDetails.addEventListener('toggle', () => {
    if (responseDetails.open && responseDetails.dataset.rendered !== '1') {
        flushInspectorJson()
    }
})

function flushInspectorJson() {
    if (pendingInspectorData !== null) {
        resJsonEl.textContent = JSON.stringify(pendingInspectorData, null, 2)
        pendingInspectorData = null
    }
    responseDetails.dataset.rendered = '1'
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
