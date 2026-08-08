import { LogOut } from "lucide-react";

import { signOut } from "@/app/(auth)/login/actions";
import { CategoryManager } from "@/components/settings/category-manager";
import { SettingsForm } from "@/components/settings/settings-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getAppSettings, getCategories } from "@/lib/data/app-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function SettingsPage() {
  const configured = isSupabaseConfigured();
  const [settings, categories] = await Promise.all([
    getAppSettings(),
    getCategories(),
  ]);

  return (
    <>
      <PageHeader title="設定" description="猫の名前、勤務目標、作業カテゴリを整えます。" />
      <div className="settings-grid">
        <SettingsForm settings={settings} />
        <CategoryManager categories={categories} />
      </div>
      {configured ? (
        <Card>
          <CardBody className="account-row">
            <div>
              <h2 className="card__title">アカウント</h2>
              <p className="card__description">この端末のログインセッションを終了します。</p>
            </div>
            <form action={signOut}>
              <button type="submit" className="secondary-button"><LogOut aria-hidden="true" />ログアウト</button>
            </form>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
