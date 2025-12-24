// Basket functionality for wishlist management
class BasketManager {
    constructor() {
        this.wishlist = this.getWishlistFromStorage();
        this.init();
    }

    init() {
        this.displayWishlist();
        this.setupEventListeners();
    }

    getWishlistFromStorage() {
        const wishlist = localStorage.getItem('wishlist');
        return wishlist ? JSON.parse(wishlist) : [];
    }

    saveWishlistToStorage() {
        localStorage.setItem('wishlist', JSON.stringify(this.wishlist));
    }

    addToWishlist(item) {
        // Ensure we always persist the latest details (price/image/title)
        const existingIndex = this.wishlist.findIndex((wishlistItem) => wishlistItem.id === item.id);
        if (existingIndex === -1) {
            this.wishlist.push(item);
            this.showNotification('Course added to wishlist!');
        } else {
            this.wishlist[existingIndex] = { ...this.wishlist[existingIndex], ...item };
            this.showNotification('Course updated in wishlist!');
        }

        this.saveWishlistToStorage();
        this.displayWishlist();
    }

    removeFromWishlist(itemId) {
        this.wishlist = this.wishlist.filter(item => item.id !== itemId);
        this.saveWishlistToStorage();
        this.displayWishlist();
        this.showNotification('Course removed from wishlist!');
    }

    displayWishlist() {
        const wishlistContent = document.getElementById('wishlist-content');
        const wishlistItems = document.getElementById('wishlist-items');
        const wishlistEmpty = document.getElementById('wishlist-empty');
        const totalPriceElement = document.getElementById('total-price');

        if (!wishlistContent || !wishlistItems || !wishlistEmpty) return;

        if (this.wishlist.length === 0) {
            wishlistItems.style.display = 'none';
            wishlistEmpty.style.display = 'block';
            totalPriceElement.textContent = '0';
            return;
        }

        wishlistEmpty.style.display = 'none';
        wishlistItems.style.display = 'block';

        // Clear existing content
        wishlistContent.innerHTML = '';

        let totalPrice = 0;

        this.wishlist.forEach(item => {
            const price = parseFloat(item.price.replace('$', ''));
            totalPrice += price;

            const itemElement = document.createElement('div');
            itemElement.className = 'wishlist-item';
            itemElement.innerHTML = `
                <div class="item-info">
                    <img src="${item.image}" alt="${item.title}" class="item-img">
                    <div class="item-details">
                        <h3>${item.title}</h3>
                        <p>${item.description}</p>
                    </div>
                </div>
                <div class="item-price">${item.price}</div>
                <button class="remove-btn" data-id="${item.id}">
                    <i class="fas fa-trash"></i> Remove
                </button>
            `;
            wishlistContent.appendChild(itemElement);
        });

        totalPriceElement.textContent = totalPrice.toFixed(2);
    }

    setupEventListeners() {
        // Remove item event listener
        document.addEventListener('click', (e) => {
            if (e.target.closest('.remove-btn')) {
                const itemId = e.target.closest('.remove-btn').dataset.id;
                this.removeFromWishlist(itemId);
            }
        });

        // Checkout button
        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => {
                if (this.wishlist.length > 0) {
                    // Navigate to checkout page
                    window.location.href = 'card.html';
                } else {
                    this.showNotification('Your wishlist is empty!');
                }
            });
        }
    }

    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 1rem 2rem;
            border-radius: 5px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize basket manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const basketManager = new BasketManager();
    
    // Make basketManager globally available for other pages
    window.basketManager = basketManager;
});

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
