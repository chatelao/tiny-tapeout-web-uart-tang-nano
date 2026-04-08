document.addEventListener('DOMContentLoaded', () => {
    const projectList = document.getElementById('projectList');
    const projectSearch = document.getElementById('projectSearch');

    let allProjects = [];

    async function fetchProjects() {
        try {
            const treeResponse = await fetch('https://api.github.com/repos/chatelao/tt-test-framework/git/trees/main?recursive=1');
            if (!treeResponse.ok) throw new Error(`HTTP error! status: ${treeResponse.status}`);
            const treeData = await treeResponse.json();
            const files = treeData.tree;

            const wasmEngines = new Set(
                files.filter(f => f.path.startsWith('wasm/') && f.path.endsWith('.js'))
                     .map(f => f.path.replace('wasm/', '').replace('.js', ''))
            );

            allProjects = [];
            files.forEach(f => {
                if (f.path.startsWith('src/data/') && f.path.endsWith('.yaml')) {
                    const name = f.path.replace('src/data/', '').replace('.yaml', '');
                    const match = name.match(/^(tt\d+)[_-](.+)$/);
                    if (match) {
                        allProjects.push({
                            id: match[1],
                            title: match[2].replace(/_/g, ' '),
                            hasWasm: wasmEngines.has(match[1])
                        });
                    } else if (name.startsWith('tt')) {
                        allProjects.push({
                            id: name,
                            title: '',
                            hasWasm: wasmEngines.has(name)
                        });
                    }
                }
            });

            // Sort numerical
            allProjects.sort((a, b) => {
                const numA = parseInt(a.id.substring(2)) || 0;
                const numB = parseInt(b.id.substring(2)) || 0;
                return numA - numB;
            });

            renderProjects(allProjects);

        } catch (e) {
            console.error('Failed to fetch projects', e);
            projectList.innerHTML = `<div class="loading">Error loading projects: ${e.message}</div>`;
        }
    }

    function renderProjects(projects) {
        if (projects.length === 0) {
            projectList.innerHTML = '<div class="loading">No projects found matching your search.</div>';
            return;
        }

        projectList.innerHTML = '';
        projects.forEach(p => {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.onclick = () => {
                window.location.href = `index.html?wasm=${p.id}`;
            };

            const info = document.createElement('div');
            info.className = 'project-info';
            info.innerHTML = `
                <h3>${p.id}</h3>
                <p>${p.title || 'Untitled Project'}</p>
            `;

            const meta = document.createElement('div');
            meta.className = 'project-meta';
            const badge = document.createElement('span');
            badge.className = p.hasWasm ? 'badge badge-wasm' : 'badge badge-no-wasm';
            badge.textContent = p.hasWasm ? 'WASM Simulation' : 'No Simulation';
            meta.appendChild(badge);

            card.appendChild(info);
            card.appendChild(meta);
            projectList.appendChild(card);
        });
    }

    projectSearch.addEventListener('input', () => {
        const query = projectSearch.value.toLowerCase().trim();
        const filtered = allProjects.filter(p =>
            p.id.toLowerCase().includes(query) ||
            p.title.toLowerCase().includes(query)
        );
        renderProjects(filtered);
    });

    fetchProjects();
});
