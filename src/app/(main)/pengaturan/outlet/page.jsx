import PageHeading from "@/components/page-heading";
import OutletManagementCard from "../component/outlet-management-card";

export default function OutletPage() {
  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Pengaturan"
          description="Kelola dan sinkronkan data outlet."
        />
      </div>

      <div className="px-4 lg:px-6">
        <OutletManagementCard />
      </div>
    </>
  );
}
