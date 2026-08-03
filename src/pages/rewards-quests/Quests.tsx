// @ts-nocheck
import {
  ArrowDown,
  ArrowDown2,
  Award,
  BuyCrypto,
  GasStation,
  InfoCircle,
} from "iconsax-react";

import { Outlet, useLocation } from "react-router-dom";

import DappBanner from "../../components/DappBanner";
import QuestList from "./components/QuestList";
import BountyBanner from "../../components/BountyBanner";
import Ranking from "./components/Ranking";
import QuestPage from "./components/QuestPage";
import { useEffect, useState } from "react";
import QuestRewardBanner from "../../components/QuestRewardBanner";
import TransactionHistory from "../../components/TransactionHistory";
import { getQuestXLM } from "../../utils/soroban";

export default function Quests({
  questStatus,
  userPoints,
  smartAccountIds,
  setSelectedQuest,
  allQuests,
  setAllQuests,
}) {
  const location = useLocation();

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-7">
        {location.pathname === "/quests" && (
          <>
            {" "}
            <QuestList
              questStatus={questStatus}
              userPoints={userPoints}
              smartAccountIds={smartAccountIds}
              setSelectedQuest={setSelectedQuest}
              allQuests={allQuests}
              setAllQuests={setAllQuests}
            />
            <BountyBanner />
          </>
        )}
        <Outlet />
        {/* <QuestPage /> */}

        {location.pathname !== "/quests" && <QuestRewardBanner />}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-7">
        <div className="lg:col-span-5">
          <TransactionHistory />
        </div>

        <Ranking />
      </div>
    </>
  );
}
