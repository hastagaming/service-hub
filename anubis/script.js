(() => {
    "use strict";

    const state = {
        ready: false,
        startedAt: Date.now()
    };

    window.ServiceHub = {
        state
    };

    document.documentElement.dataset.state = "loading";

    function initialize() {
        state.ready = true;

        document.documentElement.dataset.state = "ready";

        window.dispatchEvent(
            new CustomEvent("servicehub:ready")
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            { once: true }
        );
    } else {
        initialize();
    }
})();