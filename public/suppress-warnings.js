// Suprimir warnings do Vercel Analytics
const originalConsoleWarn = console.warn;
console.warn = function(...args) {
    if (args[0] && typeof args[0] === 'string' && 
        (args[0].includes('DialogContent') || args[0].includes('DialogTitle') || args[0].includes('Description'))) {
        return; // Suprimir warnings de acessibilidade do Vercel
    }
    originalConsoleWarn.apply(console, args);
};
