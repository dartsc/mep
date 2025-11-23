const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3333;

app.use(cors());
app.use(express.json({ limit: '500mb' }));

// Deep scan function on server side
function deepScan(obj, path = 'root', visited = new Set(), depth = 0, maxDepth = 100, matches = []) {
    if (depth > maxDepth) return matches;
    if (!obj || typeof obj !== 'object') return matches;
    
    const objId = getObjectId(obj);
    if (visited.has(objId)) return matches;
    visited.add(objId);
    
    try {
        // Get all properties including non-enumerable
        const allKeys = new Set([
            ...Object.keys(obj),
            ...Object.getOwnPropertyNames(obj)
        ]);
        
        for (let key of allKeys) {
            try {
                const descriptor = Object.getOwnPropertyDescriptor(obj, key);
                if (descriptor && descriptor.get && !descriptor.set) continue; // Skip problematic getters
                
                const val = obj[key];
                const fullPath = `${path}.${key}`;
                const valType = typeof val;
                
                // Store all primitive values
                if (valType === 'number' || valType === 'string' || valType === 'boolean') {
                    matches.push({
                        path: fullPath,
                        val: val,
                        type: valType
                    });
                }
                
                // Recurse into objects
                if (valType === 'object' && val !== null) {
                    deepScan(val, fullPath, visited, depth + 1, maxDepth, matches);
                }
            } catch(e) {}
        }
        
        // Scan prototype chain
        try {
            const proto = Object.getPrototypeOf(obj);
            if (proto && proto !== Object.prototype) {
                const protoId = getObjectId(proto);
                if (!visited.has(protoId)) {
                    deepScan(proto, `${path}.__proto__`, visited, depth + 1, maxDepth, matches);
                }
            }
        } catch(e) {}
        
        // Scan symbols
        try {
            const symbols = Object.getOwnPropertySymbols(obj);
            symbols.forEach((sym, i) => {
                try {
                    const val = obj[sym];
                    const fullPath = `${path}[Symbol(${i})]`;
                    const valType = typeof val;
                    
                    if (valType === 'number' || valType === 'string' || valType === 'boolean') {
                        matches.push({
                            path: fullPath,
                            val: val,
                            type: valType
                        });
                    }
                    
                    if (valType === 'object' && val !== null) {
                        deepScan(val, fullPath, visited, depth + 1, maxDepth, matches);
                    }
                } catch(e) {}
            });
        } catch(e) {}
        
    } catch(e) {}
    
    return matches;
}

// Generate unique ID for objects
let objectIdCounter = 0;
const objectIdMap = new WeakMap();

function getObjectId(obj) {
    if (!objectIdMap.has(obj)) {
        objectIdMap.set(obj, ++objectIdCounter);
    }
    return objectIdMap.get(obj);
}

// Filter matches based on search criteria
function filterMatches(matches, searchValue, searchType, includeStrings) {
    return matches.filter(m => {
        const val = m.val;
        const valType = m.type;
        
        if (searchType === 'exact') {
            const numValue = parseFloat(searchValue);
            if (!isNaN(numValue) && valType === 'number') {
                return val === numValue;
            }
            if (includeStrings && valType === 'string') {
                return val.includes(searchValue);
            }
        }
        
        if (searchType === 'range') {
            const parts = searchValue.split(',');
            if (parts.length === 2 && valType === 'number') {
                const min = parseFloat(parts[0]);
                const max = parseFloat(parts[1]);
                return val >= min && val <= max;
            }
        }
        
        if (searchType === 'fuzzy') {
            if (valType === 'number') {
                const numValue = parseFloat(searchValue);
                if (!isNaN(numValue)) {
                    const tolerance = numValue * 0.1;
                    return Math.abs(val - numValue) <= tolerance;
                }
            }
            if (includeStrings && valType === 'string') {
                return val.toLowerCase().includes(searchValue.toLowerCase());
            }
        }
        
        return false;
    });
}

// POST endpoint to receive serialized data and scan
app.post('/scan', (req, res) => {
    try {
        const { data, searchValue, searchType, includeStrings, maxDepth = 100 } = req.body;
        
        console.log(`Starting deep scan (depth: ${maxDepth})...`);
        const startTime = Date.now();
        
        // Parse the serialized data
        const parsedData = JSON.parse(data);
        
        // Perform deep scan
        const matches = [];
        deepScan(parsedData, 'window', new Set(), 0, maxDepth, matches);
        
        console.log(`Found ${matches.length} total properties`);
        
        // Filter matches based on search criteria
        const filtered = searchValue ? filterMatches(matches, searchValue, searchType, includeStrings) : matches;
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`Scan complete in ${elapsed}s - ${filtered.length} matches`);
        
        res.json({
            success: true,
            matches: filtered,
            total: matches.length,
            filtered: filtered.length,
            elapsed: elapsed
        });
        
    } catch (error) {
        console.error('Scan error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
    console.log(`🚀 Memory Scanner Server running on http://localhost:${PORT}`);
    console.log(`📊 Ready to handle deep scans!`);
});
