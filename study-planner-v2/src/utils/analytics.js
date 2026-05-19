import ReactGA from "react-ga4";

export const initGA = () => {
  ReactGA.initialize("G-HNK3VJPQV2");
};

export const trackPage = (pageName) => {
  ReactGA.send({
    hitType: "pageview",
    page: pageName,
  });
};

export const trackEvent = (action, category, label) => {
  ReactGA.event({
    action,
    category,
    label,
  });
};
