import { NavigationSidebar } from "@/components/navigation/navigation-sidebar";

const MainLayout = async ({
  children
}: {
  children: React.ReactNode;
}) => {
  return (
    <div className="flex h-full min-w-0">
      {/* Navigation sidebar - hidden on mobile (< 640px), visible on sm and up */}
      <div className="hidden sm:flex h-full w-14 shrink-0 flex-col overflow-hidden bg-sidebar lg:w-[72px]">
        <NavigationSidebar />
      </div>
      <main className="h-full min-w-0 flex-1">
        {children}
      </main>
    </div>
   );
}
 
export default MainLayout;