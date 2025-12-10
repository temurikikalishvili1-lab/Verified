// JavaScript for main.html
console.log('JavaScript loaded successfully!');

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    const heading = document.querySelector('h1');
    const paragraph = document.querySelector('p');
    const navbarToggle = document.querySelector('.navbar-toggle');
    const navbarMenu = document.querySelector('.navbar-menu');
    
    navbarToggle.addEventListener('click', () => {
        navbarToggle.classList.toggle('active');
        navbarMenu.classList.toggle('active');
    });

    link.addEventListener('click', () => {
        navbarToggle.classList.remove('active');
        navbarMenu.classList.remove('active');
        });
    // Add click event to heading
    heading.addEventListener('click', function() {
        this.style.color = this.style.color === 'red' ? '#2c3e50' : 'red';
        console.log('Heading clicked!');
    });
    
    // Add hover effect to paragraph
    paragraph.addEventListener('mouseover', function() {
        this.style.fontWeight = 'bold';
    });
    
    paragraph.addEventListener('mouseout', function() {
        this.style.fontWeight = 'normal';
    });
    
    // Display welcome message after 1 second
    setTimeout(function() {
        alert('Welcome to our website!');
    }, 1000);
});
