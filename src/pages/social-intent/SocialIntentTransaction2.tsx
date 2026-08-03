// @ts-nocheck
import React, { useMemo, useState } from "react";

export default function SocialIntentTransaction() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("incoming");

  const [apps, setApps] = useState([
    {
      id: "mailchimp",
      name: "Mailchimp",
      description: "Lorem ipsum dolor sit amet, consectetur adipis.",
      image:
        "https://landingfoliocom.imgix.net/store/collection/clarity-dashboard/images/previews/settings/3/mailchimp-logo.png",
      enabled: false,
    },
    {
      id: "zapier",
      name: "Zapier",
      description: "Lorem ipsum dolor sit amet, consectes.",
      image:
        "https://landingfoliocom.imgix.net/store/collection/clarity-dashboard/images/previews/settings/3/zapier-logo.png",
      enabled: true,
    },
    {
      id: "telegram",
      name: "Telegram",
      description: "Lorem ipsum dolor sit amet.",
      image:
        "https://landingfoliocom.imgix.net/store/collection/clarity-dashboard/images/previews/settings/3/telegram-logo.png",
      enabled: false,
    },
    {
      id: "slack",
      name: "Slack",
      description: "Lorem ipsum dolor sit amet, consectetur adipis.",
      image:
        "https://landingfoliocom.imgix.net/store/collection/clarity-dashboard/images/previews/settings/3/slack-logo.png",
      enabled: true,
    },
    {
      id: "dropbox",
      name: "Dropbox",
      description: "Lorem ipsum dolor sit amet adipis.",
      image:
        "https://landingfoliocom.imgix.net/store/collection/clarity-dashboard/images/previews/settings/3/dropbox-logo.png",
      enabled: false,
    },
  ]);

  const tabs = useMemo(
    () => [
      { id: "incoming", name: "Incoming Intent" },
      { id: "outgoing", name: "Outgoing Intent" },
      { id: "settings", name: "Intent Settings" },
    ],
    []
  );

  const toggleApp = (id) => {
    setApps((prev) =>
      prev.map((app) =>
        app.id === id ? { ...app, enabled: !app.enabled } : app
      )
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 xl:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="flex flex-col flex-1 ">
        <main>
          <div className="py-6">
            <div className="px-4 mx-auto sm:px-6 md:px-8">
              <h1 className="text-2xl font-bold text-gray-900">
                Social Intent Transact
              </h1>
            </div>

            <div className="px-4 mx-auto mt-8 sm:px-6 md:px-8">
              <div className="w-full pb-1 overflow-x-auto">
                <div className="border-b flex  border-gray-200">
                  <nav className="flex -mb-px space-x-10">
                    {tabs.map((tab) => {
                      const active = tab?.id === selectedTab;
                      return (
                        <button
                          onClick={() => setSelectedTab(tab?.id)}
                          key={tab?.id}
                          className={`py-3 text-sm font-medium transition-all duration-200 border-b-2 whitespace-nowrap ${
                            active
                              ? "text-indigo-600 border-indigo-600"
                              : "text-gray-500 border-transparent hover:border-gray-300"
                          }`}
                        >
                          {tab?.name}
                        </button>
                      );
                    })}
                  </nav>
                  <div className="flex-1 hidden max-w-xs ml-auto lg:block">
                    <label htmlFor="top-search" className="sr-only">
                      Search
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <svg
                          className="w-5 h-5 text-gray-400"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>

                      <input
                        id="top-search"
                        type="search"
                        className="block w-full py-2 pl-10 border border-gray-300 rounded-lg focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm"
                        placeholder="Search here"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 border border-indigo-300 rounded-lg bg-indigo-50">
                <div className="px-4 py-5 sm:p-6">
                  <div className="md:flex md:items-center md:justify-between">
                    <img
                      className="flex-shrink-0 object-cover w-16 h-16 rounded-lg"
                      src="https://landingfoliocom.imgix.net/store/collection/clarity-dashboard/images/previews/settings/3/avatar-female.png"
                      alt="Tutorial"
                    />
                    <div className="flex-1 max-w-xs mt-4 md:mt-0 md:ml-6">
                      <p className="text-base font-bold text-gray-900">
                        Learn how to connect new apps with Rareblocks API
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-500">
                        Lorem ipsum dolor sit amet, consec tetur.
                      </p>
                    </div>

                    <div className="flex items-center justify-start mt-6 space-x-6 md:ml-auto md:justify-end md:mt-0 md:space-x-reverse">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold leading-5 text-white transition-all duration-200 bg-indigo-600 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 hover:bg-indigo-500 md:order-last"
                      >
                        View Tutorial
                      </button>

                      <button
                        type="button"
                        className="text-sm font-medium text-gray-500 transition-all duration-200 hover:text-gray-900 md:order-first"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-bold text-gray-900">
                    Connect Apps
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-500">
                    Lorem ipsum dolor sit amet, consectetur adipis.
                  </p>
                </div>
              </div>

              <div className="flow-root mt-8">
                <div className="-my-5 divide-y divide-gray-200">
                  {apps.map((app) => (
                    <div key={app.id} className="py-5">
                      <div className="sm:flex sm:items-center sm:justify-between sm:space-x-5">
                        <div className="flex items-center flex-1 min-w-0">
                          <img
                            className="flex-shrink-0 object-cover w-10 h-10 rounded-full"
                            src={app.image}
                            alt={app.name}
                          />
                          <div className="flex-1 min-w-0 ml-4">
                            <p className="text-sm font-bold text-gray-900 truncate">
                              {app.name}
                            </p>
                            <p className="mt-1 text-sm font-medium text-gray-500 truncate">
                              {app.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-4 pl-14 sm:pl-0 sm:justify-end sm:mt-0 sm:space-x-6">
                          <a
                            href="#"
                            className="text-sm font-medium text-gray-400 transition-all duration-200 hover:text-gray-900"
                          >
                            Learn More
                          </a>

                          <button
                            type="button"
                            role="switch"
                            aria-checked={app.enabled}
                            onClick={() => toggleApp(app.id)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border transition-all duration-200 ease-in-out focus:outline-none ${
                              app.enabled
                                ? "bg-indigo-600 border-indigo-600"
                                : "bg-white border-gray-200"
                            }`}
                          >
                            <span className="sr-only">
                              Toggle {app.name} integration
                            </span>
                            <span
                              aria-hidden="true"
                              className={`inline-block h-3.5 w-3.5 mt-1 ml-1 transform rounded-full pointer-events-none ring-0 transition duration-200 ease-in-out ${
                                app.enabled
                                  ? "translate-x-5 bg-white"
                                  : "translate-x-0 bg-gray-400"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
