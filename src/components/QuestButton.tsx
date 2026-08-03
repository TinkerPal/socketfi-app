// @ts-nocheck
export default function QuestButton() {
  return (
    <div>
      <button
        type="button"
        className="inline-flex items-center justify-center w-full px-4 py-3 text-sm font-semibold leading-5  transition-all duration-200 text-orange-700   hover:bg-opacity-80 hover:-translate-y-[2px] "
        onClick={onOpenCreate}
      >
        <BuyCrypto className="w-6 h-auto mr-1 text-orange-700 animate-bounce" />
        Join Quests & Earn
        <ArrowRight2 className="w-4 h-auto ml-1 text-orange-700 " />
      </button>
    </div>
  );
}
