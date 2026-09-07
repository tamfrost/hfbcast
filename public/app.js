'use strict'

const API_BASE = '/api/v1/broadcasts'

const queryTypeSelect = document.getElementById('queryType')
const searchBtn = document.getElementById('searchBtn')
const statusEl = document.getElementById('status')
const tbody = document.querySelector('#resultsTable tbody')

const inputGroups = document.querySelectorAll('#inputs [data-input]')

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
    }

    clearTable()
    setStatus('Loading...', false)

    try {
        const response = await fetch(url)
        const data = await response.json()

        if (!response.ok) {
            const message = (data && data.error) ? data.error : `Request failed (${response.status})`
            setStatus(message, true)
            return
        }

        renderRows(data)
    } catch (err) {
        setStatus(`Request failed: ${err.message}`, true)
    }
}

searchBtn.addEventListener('click', runQuery)

// allow Enter key in inputs to trigger search
document.querySelectorAll('#inputs input').forEach(input => {
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') runQuery()
    })
})

// initialize view
updateInputs()
