
export const useRegisterSW = () => {
    return {
        offlineReady: [false, (_val: boolean) => { }],
        needRefresh: [false, (_val: boolean) => { }],
        updateServiceWorker: (_reload?: boolean) => Promise.resolve(),
    };
};
