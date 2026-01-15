import { vi } from 'vitest';
console.log('LOADING VIRTUAL PWA MOCK FILE');


export const useRegisterSW = () => {
    return {
        offlineReady: [false, (_val: boolean) => { }],
        needUpdate: [false, (_val: boolean) => { }],
        updateServiceWorker: (_reload?: boolean) => Promise.resolve(),
    };
};
