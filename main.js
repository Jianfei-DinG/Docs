// main.js
// 递归组件：分类树项目
  const CategoryTreeItem = {
    name: 'CategoryTreeItem',
    props: ['item', 'level', 'currentDoc', 'searchQuery'],
    template: `
      <div>
        <!-- 分类标题 -->
        <div v-if="item.type === 'category'" class="category-item" @click="$emit('toggle-category', item.id)" :style="{paddingLeft: (level * 20) + 'px'}">
          <i :class="item.expanded ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"></i>
          <span class="category-title">{{ item.title }}</span>
        </div>
        
        <!-- 文档项目 -->
        <div v-else-if="item.type === 'document'" 
             class="doc-item child-item" 
             :class="{ active: currentDoc === item.filename }"
             @click="$emit('load-doc', item.filename)"
             :style="{paddingLeft: (level * 20) + 'px'}">
          <p class="doc-title">{{ item.title }}</p>
          <small class="text-muted d-block">{{ item.filename }}</small>
          <small v-if="item.description" class="text-info d-block">{{ item.description }}</small>
        </div>
        
        <!-- 子项目（递归） -->
        <div v-if="item.type === 'category' && (item.expanded || (searchQuery && hasVisibleChildren(item))) && item.children" class="category-children">
          <category-tree-item 
            v-for="child in item.children" 
            :key="child.id || child.filename"
            :item="child" 
            :level="level + 1"
            :current-doc="currentDoc"
            :search-query="searchQuery"
            @toggle-category="$emit('toggle-category', $event)"
            @load-doc="$emit('load-doc', $event)">
          </category-tree-item>
        </div>
      </div>
    `,
    methods: {
      hasVisibleChildren(category) {
        if (!category.children || !this.searchQuery) return false;
        const query = this.searchQuery.toLowerCase();
        
        const checkChildren = (items) => {
          for (const item of items) {
            if (item.type === 'document') {
              const titleMatches = (item.title || '').toLowerCase().includes(query);
              const filenameMatches = (item.filename || '').toLowerCase().includes(query);
              const descMatches = (item.description || '').toLowerCase().includes(query);
              if (titleMatches || filenameMatches || descMatches) {
                return true;
              }
            } else if (item.type === 'category') {
              if (checkChildren(item.children || [])) {
                return true;
              }
            }
          }
          return false;
        };
        
        return checkChildren(category.children);
      }
    }
  };



const App = {
  components: {
    'category-tree-item': CategoryTreeItem
  },
  data() {
    return {
      documents: [],
      currentDoc: '',
      currentDocTitle: '',
      currentDocMetadata: {},
      renderedMarkdown: '',
      isDarkTheme: false,
      searchQuery: '',
      filteredDocuments: [],
      sidebarOpen: false,
      copyPluginInitialized: false
    };
  },
  methods: {
    // 获取文档列表
    async loadDocumentList() {
      // 动态扫描docs目录下的所有.md文件
      let files = [];
      try {
        // 尝试获取docs目录下的文件列表
        const response = await fetch('docs/');
        if (response.ok) {
          const html = await response.text();
          // 从目录列表HTML中提取.md文件
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const links = doc.querySelectorAll('a[href$="\.md"]');
          files = Array.from(links).map(link => link.getAttribute('href'));
        }
      } catch (error) {
        console.warn('无法自动扫描文件，使用默认文件列表:', error);
      }
      
      // 如果自动扫描失败，使用默认文件列表
      if (files.length === 0) {
        files = ['intro.md', 'getting-started.md', 'api-reference.md', 'faq.md', 'tutorial.md', 'advanced-config.md', 'deployment.md', 'deep-level-test.md', 'example-with-description.md', 'code-example.md', 'markdown-showcase.md', 'ubuntu22.md', 'bfsu-mirror.md'];
      }
      
      const documentsMap = new Map();
      
      for (const filename of files) {
        try {
          const response = await fetch(`docs/${filename}`);
          if (response.ok) {
            const content = await response.text();
            const metadata = this.parseFrontmatter(content);
            
            if (metadata.title && metadata.category) {
              // 支持多级分类，用 "/" 分隔
              const categoryPath = metadata.category.split('/');
              const order = metadata.order || 999;
              
              this.addDocumentToCategory(documentsMap, categoryPath, {
                id: filename,
                title: metadata.title,
                type: 'document',
                filename: filename,
                order: order,
                description: metadata.description || ''
              });
            }
          }
        } catch (error) {
          console.error(`加载文件 ${filename} 失败:`, error);
        }
      }
      
      // 转换为数组并递归排序
      this.documents = Array.from(documentsMap.values());
      this.sortDocumentsRecursively(this.documents);
    },
    
    addDocumentToCategory(documentsMap, categoryPath, document) {
      let currentMap = documentsMap;
      let currentPath = '';
      
      for (let i = 0; i < categoryPath.length; i++) {
        const categoryName = categoryPath[i].trim();
        currentPath = currentPath ? `${currentPath}/${categoryName}` : categoryName;
        
        if (!currentMap.has(currentPath)) {
          currentMap.set(currentPath, {
            id: currentPath,
            title: categoryName,
            type: 'category',
            expanded: false,
            children: [],
            subcategories: new Map()
          });
        }
        
        const category = currentMap.get(currentPath);
        
        if (i === categoryPath.length - 1) {
          // 最后一级，添加文档
          category.children.push(document);
        } else {
          // 中间级别，准备下一级
          currentMap = category.subcategories;
        }
      }
    },
    
    sortDocumentsRecursively(documents) {
      documents.forEach(category => {
        // 处理子分类
        if (category.subcategories && category.subcategories.size > 0) {
          const subcategoryArray = Array.from(category.subcategories.values());
          this.sortDocumentsRecursively(subcategoryArray);
          // 将子分类添加到children数组中
          category.children = [...category.children, ...subcategoryArray];
        }
        
        // 排序当前级别的所有内容（文档和子分类）
        if (category.children) {
          category.children.sort((a, b) => {
            // 分类排在文档前面
            if (a.type === 'category' && b.type === 'document') return -1;
            if (a.type === 'document' && b.type === 'category') return 1;
            
            // 同类型的按order或标题排序
            if (a.order === undefined && b.order === undefined) {
              return a.title.localeCompare(b.title);
            }
            if (a.order === undefined) return 1;
            if (b.order === undefined) return -1;
            return a.order - b.order;
          });
        }
      });
      
      // 排序顶级分类
      documents.sort((a, b) => a.title.localeCompare(b.title));
    },
    
    parseFrontmatter(content) {
      const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
      const match = content.match(frontmatterRegex);
      if (!match) return {};
      
      const yamlContent = match[1];
      const metadata = {};
      
      yamlContent.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          let value = line.substring(colonIndex + 1).trim();
          
          // 处理数字类型的order字段
          if (key === 'order' && !isNaN(value)) {
            value = parseInt(value);
          }
          
          metadata[key] = value;
        }
      });
      
      return metadata;
    },
    
    // 切换分类展开/折叠状态
    toggleCategory(categoryId) {
      const findAndToggleCategory = (categories) => {
        for (const category of categories) {
          if (category.id === categoryId) {
            // Vue 3中直接修改属性实现响应式更新
            category.expanded = !category.expanded;
            return true;
          }
          // 在子分类中递归查找
          if (category.children) {
            const found = findAndToggleCategory(category.children.filter(child => child.type === 'category'));
            if (found) return true;
          }
        }
        return false;
      };
      
      findAndToggleCategory(this.documents);
    },
    
    // 查找文档信息
    findDocument(filename) {
      const searchInCategory = (categories) => {
        for (const category of categories) {
          // 在当前分类的文档中查找
          const doc = category.children.find(child => child.type === 'document' && child.filename === filename);
          if (doc) return doc;
          
          // 在子分类中递归查找
          const subcategories = category.children.filter(child => child.type === 'category');
          const result = searchInCategory(subcategories);
          if (result) return result;
        }
        return null;
      };
      
      return searchInCategory(this.documents);
    },
    
    // 加载指定文档
    async loadDoc(filename) {
      this.currentDoc = filename;
      
      // 更新URL参数，但不刷新页面
      const url = new URL(window.location);
      url.searchParams.set('doc', filename);
      window.history.pushState({}, '', url);
      
      // 设置文档标题和metadata
      const doc = this.findDocument(filename);
      this.currentDocTitle = doc ? doc.title : filename;
      this.currentDocMetadata = doc || {};
      
      // 选择文档后自动关闭侧边栏
      this.sidebarOpen = false;
      
      try {
        const response = await fetch(`docs/${filename}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const rawContent = await response.text();
        
        // 解析frontmatter获取完整metadata
        const metadata = this.parseFrontmatter(rawContent);
        this.currentDocMetadata = { ...this.currentDocMetadata, ...metadata };
        
        // 移除frontmatter，只保留实际的Markdown内容
        let markdown = this.removeFrontmatter(rawContent);
        
        // 解码HTML实体
        markdown = this.decodeHtmlEntities(markdown);
        
        // 配置marked渲染器
        const renderer = new marked.Renderer();
        
        // 自定义代码块渲染
        renderer.code = function(code, language) {
          // 检查是否是 details 块
          if (language === 'details') {
            const parts = code.split('\n---\n');
            if (parts.length < 2) {
              return `<pre><code>Invalid details block format:\n${code}</code></pre>`;
            }
            const summary = parts[0].replace(/^summary:\s*/, '').trim();
            const rawContent = parts.slice(1).join('\n---\n');
            
            // 使用 marked.parse 来渲染 details 内部的 Markdown 内容
            const content = marked.parse(rawContent);

            return `<details class="custom-details">
                      <summary>${summary}</summary>
                      <div class="details-content">${content}</div>
                    </details>`;
          }

          // 对于普通代码块，使用 highlight.js 进行语法高亮
          const validLanguage = language && hljs.getLanguage(language) ? language : 'plaintext';
          const highlightedCode = hljs.highlight(code, { language: validLanguage, ignoreIllegals: true }).value;

          return `<div class="code-block-container"><pre class="hljs language-${validLanguage}"><code class="language-${validLanguage}">${highlightedCode}</code></pre></div>`;
        };
        
        // 自定义表格渲染
        renderer.table = function(header, body) {
          return `<div class="table-wrapper"><table>${header}${body}</table></div>`;
        };
        
        marked.setOptions({
          renderer: renderer,
          highlight: function(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language, ignoreIllegals: true }).value;
          },
          breaks: true,
          gfm: true,
          html: true
        });
        
        this.renderedMarkdown = marked.parse(markdown);
        
        // 在下一个tick中初始化highlight.js和复制插件
        this.$nextTick(() => {
          if (window.hljs) {
            // 高亮所有代码块
            hljs.highlightAll();
            
            // 手动添加复制按钮
            this.addCopyButtons();
          }
        });
      } catch (error) {
        console.error('Error loading document:', error);
        this.renderedMarkdown = `
          <div class="alert alert-danger" role="alert">
            <h4 class="alert-heading">加载失败</h4>
            <p>无法加载文档 "${filename}"，请检查文件是否存在。</p>
            <hr>
            <p class="mb-0">错误信息: ${error.message}</p>
          </div>
        `;
      }
    },
    
    removeFrontmatter(content) {
      const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
      return content.replace(frontmatterRegex, '');
    },
    
    // 主题切换方法
    toggleTheme() {
      this.isDarkTheme = !this.isDarkTheme;
      this.applyTheme();
      // 保存主题设置到本地存储
      localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');
    },
    
    // 应用主题
    applyTheme() {
      const lightTheme = document.getElementById('hljs-light-theme');
      const darkTheme = document.getElementById('hljs-dark-theme');

      if (this.isDarkTheme) {
        document.documentElement.setAttribute('data-theme', 'dark');
        // 暗色主题使用亮色代码块主题（更好的对比度）
        if (lightTheme) lightTheme.disabled = false;
        if (darkTheme) darkTheme.disabled = true;
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        // 亮色主题使用暗色代码块主题（更好的对比度）
        if (lightTheme) lightTheme.disabled = true;
        if (darkTheme) darkTheme.disabled = false;
      }
    },
    
    // 初始化主题
    initTheme() {
      const savedTheme = localStorage.getItem('theme');
      this.isDarkTheme = savedTheme !== 'light';
      this.applyTheme();
    },
    
    // 显示复制成功提示
    showCopySuccess() {
      // 移除已存在的提示
      const existingToast = document.querySelector('.copy-success-toast');
      if (existingToast) {
        existingToast.remove();
      }
      
      // 创建新的提示
      const toast = document.createElement('div');
      toast.className = 'copy-success-toast';
      toast.innerHTML = '<i class="fas fa-check"></i>已复制';
      
      document.body.appendChild(toast);
      
      // 显示动画
      setTimeout(() => {
        toast.classList.add('show');
      }, 10);
      
      // 3秒后自动隐藏
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }, 3000);
    },
    
    addCopyButtons() {
      // 为所有代码块添加复制按钮
      const codeBlocks = document.querySelectorAll('pre code');
      codeBlocks.forEach(codeBlock => {
        const pre = codeBlock.parentElement;
        
        // 检查是否已经有复制按钮
        if (pre.querySelector('.copy-button')) {
          return;
        }
        
        // 创建复制按钮
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.textContent = '复制';
        copyButton.style.cssText = `
          position: absolute;
          top: 8px;
          right: 8px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          color: #ffffff;
          cursor: pointer;
          z-index: 10;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          transition: all 0.2s ease;
          opacity: 0.8;
        `;
        
        // 添加hover效果
        copyButton.addEventListener('mouseenter', () => {
          copyButton.style.opacity = '1';
          copyButton.style.transform = 'translateY(-1px)';
          copyButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        });
        
        copyButton.addEventListener('mouseleave', () => {
          copyButton.style.opacity = '0.8';
          copyButton.style.transform = 'translateY(0)';
          copyButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        });
        
        // 设置pre元素为相对定位
        pre.style.position = 'relative';
        
        // 添加点击事件
        copyButton.addEventListener('click', () => {
          const originalText = copyButton.textContent;
          navigator.clipboard.writeText(codeBlock.textContent).then(() => {
            // 更改按钮文本为"已复制"
            copyButton.textContent = '已复制';
            copyButton.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
            
            // 2秒后恢复原始文本
            setTimeout(() => {
              copyButton.textContent = originalText;
              copyButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            }, 2000);
          });
        });
        
        // 添加按钮到pre元素
        pre.appendChild(copyButton);
      });
    },
    
    // 解码HTML实体
    decodeHtmlEntities(text) {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = text;
      return textarea.value;
    },
    
    // 搜索相关方法
    filterDocuments() {
      if (!this.searchQuery.trim()) {
        this.filteredDocuments = this.documents;
        return;
      }
      
      const query = this.searchQuery.toLowerCase();
      this.filteredDocuments = this.filterDocumentsRecursive(this.documents, query);
    },
    
    filterDocumentsRecursive(items, query) {
      const filtered = [];

      for (const item of items) {
        if (item.type === 'category') {
          const filteredChildren = this.filterDocumentsRecursive(item.children || [], query);
          const categoryMatches = (item.title || '').toLowerCase().includes(query);

          if (filteredChildren.length > 0 || categoryMatches) {
            filtered.push({
              ...item,
              children: filteredChildren.length > 0 ? filteredChildren : item.children,
              expanded: true
            });
          }
        } else if (item.type === 'document') {
          const titleMatches = (item.title || '').toLowerCase().includes(query);
          const filenameMatches = (item.filename || '').toLowerCase().includes(query);
          const descMatches = (item.description || '').toLowerCase().includes(query);

          if (titleMatches || filenameMatches || descMatches) {
            filtered.push(item);
          }
        }
      }

      return filtered;
    },
    
    clearSearch() {
      this.searchQuery = '';
      this.filteredDocuments = this.documents;
    },
    
    // 切换侧边栏
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
    },
    
    // 关闭侧边栏
    closeSidebar() {
      this.sidebarOpen = false;
    }
  },

  watch: {
    searchQuery(newQuery) {
      if (!newQuery.trim()) {
        this.filteredDocuments = this.documents;
      } else {
        this.filteredDocuments = this.filterDocumentsRecursive(this.documents, newQuery.toLowerCase());
      }
    }
  },
  
  async mounted() {
    // 初始化主题
    this.initTheme();
    
    // highlightjs-copy插件将在loadDoc中初始化
    
    // 加载文档列表
    await this.loadDocumentList();
    
    // 初始化过滤后的文档列表
    this.filteredDocuments = this.documents;
    
    // 检查URL参数中是否指定了文档
    const urlParams = new URLSearchParams(window.location.search);
    const docFromUrl = urlParams.get('doc');
    
    if (docFromUrl && this.findDocument(docFromUrl)) {
      // 如果URL中指定了有效的文档，加载该文档
      this.loadDoc(docFromUrl);
    } else {
      // 否则加载默认文档
      if (this.documents.length > 0 && this.documents[0].children && this.documents[0].children.length > 0) {
        const firstDoc = this.documents[0].children.find(child => child.type === 'document');
        if (firstDoc) {
          this.loadDoc(firstDoc.filename);
        }
      }
    }
    
    // 监听浏览器前进后退按钮
    window.addEventListener('popstate', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const docFromUrl = urlParams.get('doc');
      if (docFromUrl && this.findDocument(docFromUrl)) {
        this.loadDoc(docFromUrl);
      }
    });
  }
};

const app = Vue.createApp(App);
app.component('CategoryTreeItem', CategoryTreeItem);

app.mount('#app');
