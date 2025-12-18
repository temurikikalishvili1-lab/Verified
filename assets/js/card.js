// Checkout page functionality (Bank of Georgia redirect only)
class CheckoutManager {
    constructor() {
        this.wishlist = this.getWishlistFromStorage();
        this.emailServiceReady = false;
        this.currency = 'gel';
        this.bogAvailable = false;
        this.init();
    }

    async init() {
        await this.loadPaymentProvider();
        this.configureEmail();
        this.displayOrderSummary();
        this.setupFormHandlers();
    }

    getWishlistFromStorage() {
        const wishlist = localStorage.getItem('wishlist');
        return wishlist ? JSON.parse(wishlist) : [];
    }

    async loadPaymentProvider() {
        try {
            const res = await fetch('/api/payments/provider');
            const data = await res.json();
            this.currency = (data?.currency || this.currency || 'gel').toLowerCase();
            this.bogAvailable = data?.bogConfigured !== false;
            this.toggleBogButton(this.bogAvailable);
        } catch (err) {
            console.warn('Failed to load payment provider info', err);
            this.toggleBogButton(false);
        }
    }

    toggleBogButton(enabled) {
        const bogBtn = document.getElementById('bog-pay-btn');
        if (bogBtn) {
            bogBtn.disabled = !enabled;
            bogBtn.textContent = enabled ? 'Pay with Bank of Georgia' : 'Payment unavailable';
        }
    }

    displayOrderSummary() {
        const orderItems = document.getElementById('order-items');
        const orderTotal = document.getElementById('order-total');

        if (!orderItems || !orderTotal) return;

        if (this.wishlist.length === 0) {
            setTimeout(() => {
                window.location.href = 'basket.html';
            }, 1000);
            return;
        }

        orderItems.innerHTML = '';

        let totalPrice = 0;

        this.wishlist.forEach(item => {
            const price = parseFloat(item.price.replace('$', ''));
            totalPrice += price;

            const itemElement = document.createElement('div');
            itemElement.className = 'order-item';
            itemElement.innerHTML = `
                <span class="order-item-name">${item.title}</span>
                <span class="order-item-price">${item.price}</span>
            `;
            orderItems.appendChild(itemElement);
        });

        orderTotal.textContent = totalPrice.toFixed(2);
    }

    setupFormHandlers() {
        const paymentForm = document.getElementById('payment-form');
        if (paymentForm) {
            paymentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleBogPayment();
            });
        }
    }

    async handleBogPayment() {
        const cardholderName = document.getElementById('cardholder-name')?.value || '';
        const customerEmail = document.getElementById('customer-email')?.value || '';

        if (!this.bogAvailable) {
            this.showNotification('Bank of Georgia payments are not configured.', 'error');
            return;
        }

        if (cardholderName.trim().length < 2) {
            this.showNotification('Please enter the payer name', 'error');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerEmail)) {
            this.showNotification('Please enter a valid email address', 'error');
            return;
        }

        const items = this.wishlist
            .map((item) => ({ price: this.parsePrice(item.price) }))
            .filter((item) => Number.isFinite(item.price) && item.price > 0);

        const total = items.reduce((sum, item) => sum + item.price, 0);
        if (!items.length || total <= 0) {
            this.showNotification('Your basket is empty or invalid.', 'error');
            return;
        }

        this.showNotification('Redirecting to Bank of Georgia...', 'info');

        const order = await this.createBogOrder(items, {
            email: customerEmail,
            name: cardholderName,
            description: 'Course order'
        });

        if (!order) return;

        this.submitRedirectForm(order.gatewayUrl, order.payload, order.method);
    }

    async createBogOrder(items, metadata = {}) {
        try {
            const res = await fetch('/api/payments/bog/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, metadata })
            });

            const data = await res.json();
            if (!res.ok) {
                this.showNotification(data?.error || 'Failed to start payment.', 'error');
                return null;
            }

            if (!data?.gatewayUrl || !data?.payload) {
                this.showNotification('Gateway data is missing. Check server config.', 'error');
                return null;
            }

            return data;
        } catch (err) {
            console.error('BOG order creation failed:', err);
            this.showNotification('Network error while starting payment.', 'error');
            return null;
        }
    }

    submitRedirectForm(gatewayUrl, payload, method = 'POST') {
        if (!gatewayUrl || !payload) {
            this.showNotification('Cannot continue to payment gateway.', 'error');
            return;
        }

        const form = document.createElement('form');
        form.method = method || 'POST';
        form.action = gatewayUrl;
        form.style.display = 'none';

        Object.entries(payload).forEach(([key, value]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value;
            form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
    }

    showNotification(message, type = 'success') {
        const existingNotifications = document.querySelectorAll('.checkout-notification');
        existingNotifications.forEach(notif => notif.remove());

        const notification = document.createElement('div');
        notification.className = 'checkout-notification';
        notification.textContent = message;
        
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            info: '#3498db'
        };

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.success};
            color: white;
            padding: 1rem 2rem;
            border-radius: 10px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            font-weight: bold;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    configureEmail() {
        if (typeof emailjs !== 'undefined') {
            try {
                emailjs.init('I5dswEBm59WQYramj');
                this.emailServiceReady = true;
            } catch (err) {
                console.warn('EmailJS init failed:', err);
            }
        }
    }

    parsePrice(priceString = '') {
        const numeric = parseFloat(String(priceString).replace(/[^0-9.]/g, ''));
        return Number.isFinite(numeric) ? numeric : 0;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const checkoutManager = new CheckoutManager();
    window.checkoutManager = checkoutManager;
});

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


