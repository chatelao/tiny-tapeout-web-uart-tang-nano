document.addEventListener('DOMContentLoaded', () => {
    const projectsBody = document.getElementById('projectsBody');
    const projectSearch = document.getElementById('projectSearch');
    let allProjects = [];

    async function fetchAllProjects() {
        try {
            // Using recursive trees API to get everything in one go
            const response = await fetch('https://api.github.com/repos/chatelao/tt-test-framework/git/trees/main?recursive=1');
            if (!response.ok) throw new Error('Failed to fetch repository tree');
            const data = await response.json();

            const wasmFiles = new Set();
            const yamlFiles = new Map(); // ID -> { name, download_url }

            data.tree.forEach(item => {
                if (item.path.startsWith('wasm/') && item.path.endsWith('.js')) {
                    wasmFiles.add(item.path.replace('wasm/', '').replace('.js', ''));
                } else if (item.path.startsWith('src/data/') && item.path.endsWith('.yaml')) {
                    const fileName = item.path.replace('src/data/', '');
                    const match = fileName.match(/^(tt\d+)[_-](.+)\.yaml$/);
                    const id = match ? match[1] : fileName.replace('.yaml', '');
                    const title = match ? match[2].replace(/_/g, ' ') : '';

                    if (!yamlFiles.has(id) || match) { // Prefer files with titles in name
                        yamlFiles.set(id, {
                            id,
                            title,
                            fileName,
                            url: `https://raw.githubusercontent.com/chatelao/tt-test-framework/main/${item.path}`
                        });
                    }
                }
            });

            // Combine into a single list
            const projectIds = new Set([...wasmFiles, ...yamlFiles.keys()]);
            allProjects = Array.from(projectIds).map(id => {
                const yamlInfo = yamlFiles.get(id);
                return {
                    id,
                    title: yamlInfo ? yamlInfo.title : '',
                    hasWasm: wasmFiles.has(id),
                    hasYaml: !!yamlInfo,
                    yamlUrl: yamlInfo ? yamlInfo.url : null,
                    projectName: yamlInfo ? yamlInfo.fileName.replace('.yaml', '') : id
                };
            });

            // Sort by ID
            allProjects.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

            renderProjects(allProjects);

        } catch (e) {
            console.error(e);
            projectsBody.innerHTML = `<tr><td colspan="5" style="color: red;">Error: ${e.message}</td></tr>`;
        }
    }

    function renderProjects(projects) {
        projectsBody.innerHTML = '';
        if (projects.length === 0) {
            projectsBody.innerHTML = '<tr><td colspan="5">No projects found matching your search.</td></tr>';
            return;
        }

        projects.forEach(p => {
            const tr = document.createElement('tr');

            const idTd = document.createElement('td');
            idTd.textContent = p.id;
            tr.appendChild(idTd);

            const titleTd = document.createElement('td');
            titleTd.textContent = p.title || '-';
            tr.appendChild(titleTd);

            const wasmTd = document.createElement('td');
            wasmTd.textContent = p.hasWasm ? '✅' : '❌';
            tr.appendChild(wasmTd);

            const yamlTd = document.createElement('td');
            yamlTd.textContent = p.hasYaml ? '✅' : '❌';
            tr.appendChild(yamlTd);

            const actionTd = document.createElement('td');
            const loadBtn = document.createElement('button');
            loadBtn.textContent = 'Load in Tester';
            loadBtn.onclick = () => {
                const url = new URL('index.html', window.location.href);
                if (p.hasWasm) url.searchParams.set('wasm', p.id);
                if (p.hasYaml) url.searchParams.set('project', p.projectName);
                window.location.href = url.toString();
            };
            actionTd.appendChild(loadBtn);
            tr.appendChild(actionTd);

            projectsBody.appendChild(tr);
        });
    }

    projectSearch.addEventListener('input', () => {
        const query = projectSearch.value.toLowerCase();
        const filtered = allProjects.filter(p =>
            p.id.toLowerCase().includes(query) ||
            p.title.toLowerCase().includes(query)
        );
        renderProjects(filtered);
    });

    fetchAllProjects();
});
