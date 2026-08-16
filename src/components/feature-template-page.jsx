import PageHeading from "@/components/page-heading";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function FeatureTemplatePage({
  title,
  description,
  sectionTitle = "Ringkasan",
  sectionDescription,
  emptyMessage = "Halaman ini siap dihubungkan dengan sumber data.",
  action = null,
}) {
  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading title={title} description={description} action={action} />
      </div>
      <div className="px-4 lg:px-6">
        <Card className="border-t-4 border-t-primary">
          <CardHeader className="border-b pb-5">
            <CardTitle className="text-xl">{sectionTitle}</CardTitle>
            {sectionDescription ? (
              <CardDescription>{sectionDescription}</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="pt-5">
            <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed bg-muted/40 px-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
