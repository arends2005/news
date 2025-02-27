document.addEventListener('DOMContentLoaded', () => {
  // Prevent dropdown from closing when clicking inside
  $(document).on('click', '.dropdown-menu', function (e) {
    e.stopPropagation();
  });

  // Initialize dropdown
  $('.dropdown-toggle').dropdown();

  function initializeAddArticleForm() {
    const addArticleForm = document.querySelector('#add-article-form');
    if (addArticleForm) {
      // Prevent dropdown from closing when clicking inside the form
      addArticleForm.addEventListener('click', (event) => {
        event.stopPropagation();
      });

      // Handle form submission
      addArticleForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Get form data
        const url = this.querySelector('#url').value;
        const notes = this.querySelector('#notes').value;
        
        // Disable submit button
        const submitButton = this.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        
        try {
          const response = await fetch('/articles', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ url, notes })
          });
          
          if (!response.ok) {
            throw new Error('Failed to save article');
          }
          
          // Clear form
          this.reset();
          
          // Close dropdown using jQuery
          $('#addArticleDropdown').dropdown('hide');
          $('.dropdown-menu').removeClass('show');
          
          // Refresh articles list
          const currentFilter = document.querySelector('#filterDropdown').dataset.value || 'all';
          const selectedCategories = Array.from(document.querySelectorAll('.category-filter:checked')).map(cb => cb.value);
          await filterArticles(currentFilter, selectedCategories);
          
        } catch (error) {
          console.error('Error:', error);
          alert('Failed to save article');
        } finally {
          submitButton.disabled = false;
        }
      });
    }
  }

  // Initialize the add article form
  initializeAddArticleForm();

  // Handle filter changes from navbar
  const filterDropdown = document.querySelector('#filterDropdown');
  const filterItems = document.querySelectorAll('#filterDropdown + .dropdown-menu .dropdown-item');
  
  filterItems.forEach(item => {
    item.addEventListener('click', async function(event) {
      event.preventDefault();
      const filterValue = this.dataset.value;
      
      // Update dropdown text
      filterDropdown.textContent = this.textContent.trim();
      
      // Store the current filter value
      filterDropdown.dataset.value = filterValue;
      
      // Filter articles
      await filterArticles(filterValue, Array.from(selectedCategories));
    });
  });

  // Handle category filter changes
  const categoryCheckboxes = document.querySelectorAll('.category-filter');
  let selectedCategories = new Set();

  categoryCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', async function() {
      if (this.checked) {
        selectedCategories.add(this.value);
        // Sync checkboxes with same value
        document.querySelectorAll(`.category-filter[value="${this.value}"]`).forEach(cb => {
          cb.checked = true;
        });
      } else {
        selectedCategories.delete(this.value);
        // Sync checkboxes with same value
        document.querySelectorAll(`.category-filter[value="${this.value}"]`).forEach(cb => {
          cb.checked = false;
        });
      }
      
      // Get current filter value
      const currentFilterValue = filterDropdown.dataset.value || 'all';
      await filterArticles(currentFilterValue, Array.from(selectedCategories));
    });
  });

  // Handle add category functionality
  const addCategoryBtn = document.querySelector('#nav-add-category-btn');
  const addCategoryModal = new bootstrap.Modal(document.getElementById('addCategoryModal'));
  const saveCategoryBtn = document.querySelector('#save-category-btn');
  const newCategoryInput = document.querySelector('#new-category-input');

  addCategoryBtn.addEventListener('click', (event) => {
    event.preventDefault();
    addCategoryModal.show();
  });

  saveCategoryBtn.addEventListener('click', async () => {
    const categoryName = newCategoryInput.value.trim();
    
    if (!categoryName) {
      alert('Please enter a category name');
      return;
    }
    
    saveCategoryBtn.disabled = true;
    
    try {
      const response = await fetch('/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ name: categoryName })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add category');
      }
      
      const data = await response.json();
      
      // Check if category already exists
      const existingCheckbox = document.querySelector(`.category-filter[data-name="${categoryName}"]`);
      if (existingCheckbox) {
        existingCheckbox.classList.add('highlight');
        setTimeout(() => existingCheckbox.classList.remove('highlight'), 2000);
      } else {
        // Add new checkbox to both navbar and article edit forms
        const checkboxTemplate = `
          <div class="dropdown-item">
            <div class="form-check">
              <input class="form-check-input category-filter" 
                     type="checkbox" 
                     value="${data.category.id}"
                     data-name="${data.category.name}"
                     id="nav-category-${data.category.id}">
              <label class="form-check-label" for="nav-category-${data.category.id}">
                ${data.category.name}
              </label>
            </div>
          </div>
        `;
        
        // Add to navbar dropdown
        const dropdownMenu = document.querySelector('#categoriesDropdown + .dropdown-menu');
        const addCategoryItem = dropdownMenu.querySelector('#nav-add-category-btn').parentElement;
        addCategoryItem.insertAdjacentHTML('beforebegin', checkboxTemplate);
        
        // Initialize the new checkbox
        const newCheckbox = dropdownMenu.querySelector(`#nav-category-${data.category.id}`);
        newCheckbox.addEventListener('change', async function() {
          if (this.checked) {
            selectedCategories.add(this.value);
          } else {
            selectedCategories.delete(this.value);
          }
          const currentFilterValue = filterDropdown.dataset.value || 'all';
          await filterArticles(currentFilterValue, Array.from(selectedCategories));
        });
      }
      
      // Clear and close the modal
      newCategoryInput.value = '';
      addCategoryModal.hide();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to add category');
    } finally {
      saveCategoryBtn.disabled = false;
    }
  });

  // Function to filter articles based on selected categories
  async function filterArticles(filterValue = 'all', categories = []) {
    try {
      const categoriesParam = categories.join(',');
      const response = await fetch(`/?filter=${filterValue}&categories=${categoriesParam}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to filter articles');
      }

      const data = await response.json();
      
      const articleList = document.getElementById('article-list');
      if (!articleList) {
        throw new Error('Article list element not found');
      }
      
      // Clear current articles
      articleList.innerHTML = '';
      
      if (!data.articles || !data.articles.length) {
        articleList.innerHTML = '<div class="list-group-item">No articles found</div>';
      } else {
        // Add new articles with the updated template
        data.articles.forEach((article, index) => {
          const articleElement = document.createElement('div');
          articleElement.className = 'list-group-item article-item';
          articleElement.dataset.id = article.id;
          articleElement.dataset.order = article.display_order;
          
          articleElement.innerHTML = `
            <div class="d-flex w-100 justify-content-between mb-1">
              <div class="d-flex align-items-center">
                <span class="article-order">${index + 1}</span>
                <h5 class="mb-1">
                  <a href="${article.url}" target="_blank" rel="noopener noreferrer">
                    ${article.url}
                  </a>
                </h5>
              </div>
              <div class="d-flex align-items-center">
                <div class="form-check form-switch me-3 d-flex align-items-center">
                  <input class="form-check-input favorite-toggle" 
                         type="checkbox" 
                         role="switch" 
                         id="favorite-${article.id}"
                         data-id="${article.id}"
                         ${article.favorite ? 'checked' : ''}
                         title="Toggle favorite">
                  <i class="fas fa-star ms-2 favorite-star ${article.favorite ? 'text-warning' : 'd-none'}"></i>
                </div>
                <small>
                  ${new Date(article.created_at).toLocaleDateString()}
                </small>
              </div>
            </div>
            <div class="mb-2">
              ${article.categories && article.categories.length > 0 ? `
                <div class="article-categories">
                  ${article.categories.map(catId => {
                    const category = data.categories.find(c => c.id === catId);
                    return category ? `
                      <span class="badge badge-info mr-1">${category.name}</span>
                    ` : '';
                  }).join('')}
                </div>
              ` : ''}
            </div>
            <div class="mb-3 notes-display">
              <p class="mb-1">${article.notes || ''}</p>
            </div>
            <div class="notes-edit" style="display: none;">
              <textarea class="form-control mb-2 edit-notes">${article.notes || ''}</textarea>
              <div class="mb-2">
                <label class="form-label">Categories:</label>
                <div class="category-selection d-flex flex-wrap">
                  ${data.categories.map(category => `
                    <div class="form-check mr-3">
                      <input class="form-check-input article-category" 
                             type="checkbox" 
                             value="${category.id}"
                             id="category-${article.id}-${category.id}"
                             ${article.categories && article.categories.includes(category.id) ? 'checked' : ''}>
                      <label class="form-check-label" for="category-${article.id}-${category.id}">
                        ${category.name}
                      </label>
                    </div>
                  `).join('')}
                </div>
              </div>
              <button class="btn btn-sm btn-success save-notes">Save</button>
              <button class="btn btn-sm btn-secondary cancel-edit">Cancel</button>
            </div>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary edit-btn">Edit Notes</button>
              <button class="btn btn-outline-danger delete-btn">Delete</button>
            </div>
          `;
          
          articleList.appendChild(articleElement);
        });
      }
      
      // Update article count
      const countBadge = document.querySelector('.card-header .badge');
      if (countBadge) {
        countBadge.textContent = `${data.articles.length} articles`;
      }
      
      // Reinitialize event listeners
      initializeEventListeners();

    } catch (error) {
      console.error('Error:', error);
      alert('Failed to filter articles');
    }
  }

  // Function to initialize all event listeners
  function initializeEventListeners() {
    // Initialize Sortable
    const articleList = document.getElementById('article-list');
    if (articleList) {
      new Sortable(articleList, {
        animation: 150,
        onEnd: function(evt) {
          const items = articleList.querySelectorAll('.article-item');
          const orders = Array.from(items).map((item, index) => ({
            id: item.dataset.id,
            order: index + 1
          }));

          // Update order numbers visually
          items.forEach((item, index) => {
            item.querySelector('.article-order').textContent = index + 1;
          });

          // Send the new order to the server
          fetch('/articles/order', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ orders })
          })
          .catch(error => {
            console.error('Error updating order:', error);
            alert('Failed to update article order');
          });
        }
      });
    }

    // Initialize all other event listeners
    initializeFavoriteButtons();
    initializeDeleteButtons();
    initializeEditButtons();
    initializeCancelButtons();
    initializeSaveButtons();
  }

  // Initialize all event listeners on page load
  initializeEventListeners();

  // Remove any existing event listeners
  const form = document.querySelector('.article-form');
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  // Function to handle delete
  function handleDelete(event) {
    event.preventDefault();
    event.stopPropagation(); // Add this to prevent event bubbling
    
    const button = event.currentTarget;
    
    // Remove the event listener immediately to prevent double-clicks
    button.removeEventListener('click', handleDelete);
    
    if (!confirm('Are you sure you want to delete this article?')) {
      // Re-add the event listener if user cancels
      button.addEventListener('click', handleDelete);
      return;
    }
    
    const articleItem = button.closest('.article-item');
    const articleId = articleItem.dataset.id;
    
    if (!articleId) {
      console.error('No article ID found');
      return;
    }
    
    // Disable the delete button immediately
    button.disabled = true;
    
    // Remove the article from UI immediately
    const countBadge = document.querySelector('.card-header .badge');
    const currentCount = parseInt(countBadge.textContent);
    countBadge.textContent = `${currentCount - 1} articles`;
    articleItem.remove();
    
    // Then send the delete request to the server
    fetch(`/articles/${articleId}`, {
      method: 'DELETE'
    })
    .then(response => {
      if (!response.ok && response.status !== 404) {
        throw new Error('Failed to delete article');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      // If there's an error, we don't need to show it to the user since the article is already removed from UI
    });
  }

  // Function to handle edit
  function handleEdit(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const articleItem = button.closest('.article-item');
    const notesDisplay = articleItem.querySelector('.notes-display');
    const notesEdit = articleItem.querySelector('.notes-edit');
    
    notesDisplay.style.display = 'none';
    notesEdit.style.display = 'block';
  }

  // Function to handle cancel
  function handleCancel(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const articleItem = button.closest('.article-item');
    const notesDisplay = articleItem.querySelector('.notes-display');
    const notesEdit = articleItem.querySelector('.notes-edit');
    
    notesDisplay.style.display = 'block';
    notesEdit.style.display = 'none';
  }

  // Function to handle save notes
  function handleSaveNotes(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const articleItem = button.closest('.article-item');
    const articleId = articleItem.dataset.id;
    const notesTextarea = articleItem.querySelector('.edit-notes');
    const notesText = notesTextarea.value;
    const notesDisplay = articleItem.querySelector('.notes-display p');
    
    // Get selected categories
    const selectedCategories = Array.from(
      articleItem.querySelectorAll('.article-category:checked')
    ).map(checkbox => parseInt(checkbox.value));
    
    // Disable save button
    button.disabled = true;
    
    fetch(`/articles/${articleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ 
        notes: notesText,
        categories: selectedCategories
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to update article');
      }
      return response.json();
    })
    .then(data => {
      notesDisplay.textContent = notesText;
      articleItem.querySelector('.notes-display').style.display = 'block';
      articleItem.querySelector('.notes-edit').style.display = 'none';
      
      // Update the article's data attributes with new category information
      if (data.article.categories) {
        articleItem.dataset.categories = JSON.stringify(data.article.categories);
      }
    })
    .catch(error => {
      console.error('Error:', error);
      alert('Failed to update article');
    })
    .finally(() => {
      button.disabled = false;
    });
  }

  // Helper functions to initialize specific event listeners
  function initializeFavoriteButtons() {
    document.querySelectorAll('.favorite-toggle').forEach(toggle => {
      // Remove any existing event listeners first
      const newToggle = toggle.cloneNode(true);
      toggle.parentNode.replaceChild(newToggle, toggle);
      
      newToggle.addEventListener('change', async function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Disable the toggle while processing
        this.disabled = true;
        
        const articleId = this.dataset.id;
        const wasChecked = this.checked;
        const starIcon = this.parentElement.querySelector('.favorite-star');
        
        try {
          const response = await fetch(`/articles/${articleId}/favorite`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          
          const data = await response.json();
          
          if (!response.ok || !data.success) {
            // Revert the toggle if the request failed
            this.checked = !wasChecked;
            starIcon.classList.toggle('text-warning', !wasChecked);
            starIcon.classList.toggle('d-none', wasChecked);
            throw new Error(data.error || 'Failed to toggle favorite');
          }
          
          // Update star visibility on success
          starIcon.classList.toggle('text-warning', this.checked);
          starIcon.classList.toggle('d-none', !this.checked);
          
          // Update the title based on state
          this.title = this.checked ? 'Remove from favorites' : 'Add to favorites';
          
        } catch (error) {
          console.error('Error:', error);
          alert('Failed to toggle favorite');
        } finally {
          // Re-enable the toggle
          this.disabled = false;
        }
      });
    });
  }

  function initializeDeleteButtons() {
    document.querySelectorAll('.delete-btn').forEach(button => {
      // Remove any existing event listeners first
      button.removeEventListener('click', handleDelete);
      // Add the event listener
      button.addEventListener('click', handleDelete);
    });
  }

  function initializeEditButtons() {
    document.querySelectorAll('.edit-btn').forEach(button => {
      button.addEventListener('click', handleEdit);
    });
  }

  function initializeCancelButtons() {
    document.querySelectorAll('.cancel-edit').forEach(button => {
      button.addEventListener('click', handleCancel);
    });
  }

  function initializeSaveButtons() {
    document.querySelectorAll('.save-notes').forEach(button => {
      button.addEventListener('click', handleSaveNotes);
    });
  }
});