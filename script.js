const GITHUB_USERNAME = 'Velfri';
const GITHUB_API = `https://api.github.com/users/${GITHUB_USERNAME}`;
const FEATURED_TOPIC = 'featured';

// Theme management
class ThemeManager {
    constructor() {
        this.STORAGE_KEY = 'velfri-theme';
        this.init();
    }

    init() {
        const savedTheme = localStorage.getItem(this.STORAGE_KEY) || 'dark';
        this.setTheme(savedTheme);
        this.setupToggle();
    }

    setTheme(theme) {
        const body = document.body;
        if (theme === 'light') {
            body.classList.add('light-theme');
        } else {
            body.classList.remove('light-theme');
        }
        localStorage.setItem(this.STORAGE_KEY, theme);
        this.updateToggleButton();
    }

    toggle() {
        const current = localStorage.getItem(this.STORAGE_KEY) || 'dark';
        const newTheme = current === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    setupToggle() {
        const toggle = document.querySelector('.theme-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => this.toggle());
        }
    }

    updateToggleButton() {
        const toggle = document.querySelector('.theme-toggle');
        if (toggle) {
            const current = localStorage.getItem(this.STORAGE_KEY) || 'dark';
            toggle.textContent = current === 'dark' ? '☀️' : '🌙';
        }
    }
}

// Navbar scroll handler
class ScrollableNavbar {
    constructor() {
        this.navbar = document.querySelector('.navbar');
        this.isScrolled = false;
        this.init();
    }

    init() {
        window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
    }

    handleScroll() {
        const scrolled = window.scrollY > 20;
        if (scrolled !== this.isScrolled) {
            this.isScrolled = scrolled;
            if (scrolled) {
                this.navbar.classList.add('scrolled');
            } else {
                this.navbar.classList.remove('scrolled');
            }
        }
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme manager
    const themeManager = new ThemeManager();

    // Initialize scrollable navbar
    new ScrollableNavbar();

    // Mobile menu toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });

        // Close menu when clicking on a link
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });
    }

    // Update active nav link
    const navLinks = document.querySelectorAll('.nav-link');
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });

    // Search functionality
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const query = this.value.trim();
                if (query) {
                    searchProjects(query);
                }
            }
        });
    }

    // Load featured projects
    loadFeaturedProjects();
    
    // Load stats
    loadGitHubStats();

    // Create star animations
    createStars();
});

function searchProjects(query) {
    const projectCards = document.querySelectorAll('.project-card');
    let found = 0;

    projectCards.forEach(card => {
        const title = card.querySelector('h3').textContent.toLowerCase();
        if (title.includes(query.toLowerCase())) {
            card.style.display = 'block';
            card.style.animation = 'pulse 0.5s ease';
            found++;
        } else {
            card.style.display = 'none';
        }
    });

    if (found === 0 && document.querySelector('.search-input')) {
        console.log('No projects found matching: ' + query);
    }
}

async function loadFeaturedProjects() {
    const container = document.getElementById('projectsContainer');
    if (!container) return;

    try {
        const response = await fetch(`${GITHUB_API}/repos?sort=stars&per_page=100`);
        const repos = await response.json();

        if (!Array.isArray(repos)) {
            container.innerHTML = '<p>Unable to load projects</p>';
            return;
        }

        const featuredRepos = repos.filter(repo => 
            repo.topics && repo.topics.includes(FEATURED_TOPIC)
        );

        if (featuredRepos.length === 0) {
            container.innerHTML = '<p>No featured projects yet. Add the "' + FEATURED_TOPIC + '" topic to your GitHub repositories.</p>';
            return;
        }

        container.innerHTML = '';
        featuredRepos.slice(0, 6).forEach((repo, index) => {
            const delay = index * 0.1;
            const card = document.createElement('div');
            card.className = 'project-card';
            card.style.animationDelay = `${delay}s`;
            card.innerHTML = `
                <h3>${repo.name}</h3>
                <div class="tech-tags">
                    ${repo.language ? `<span class="tag">${repo.language}</span>` : ''}
                    ${repo.stargazers_count > 0 ? `<span class="tag">⭐ ${repo.stargazers_count}</span>` : ''}
                </div>
                <div style="flex-grow: 1;"></div>
                <a href="${repo.html_url}" target="_blank">View on GitHub →</a>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading projects:', error);
        if (container) {
            container.innerHTML = '<p>Unable to load projects</p>';
        }
    }
}

async function loadGitHubStats() {
    try {
        const userResponse = await fetch(`${GITHUB_API}`);
        const userData = await userResponse.json();

        const reposResponse = await fetch(`${GITHUB_API}/repos?per_page=100`);
        const repos = await reposResponse.json();

        // Update counts
        const repoCount = document.getElementById('repoCount');
        const followerCount = document.getElementById('followerCount');
        const starCount = document.getElementById('starCount');

        if (repoCount) repoCount.textContent = userData.public_repos || 0;
        if (followerCount) followerCount.textContent = userData.followers || 0;

        if (starCount && Array.isArray(repos)) {
            const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
            starCount.textContent = totalStars;
        }
    } catch (error) {
        console.error('Error loading GitHub stats:', error);
    }
}

function createStars() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    for (let i = 0; i < 20; i++) {
        const star = document.createElement('div');
        star.className = 'stars';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';
        star.style.animationDuration = (Math.random() * 2 + 2) + 's';
        hero.appendChild(star);
    }
}

