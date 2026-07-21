export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Enums: {
      app_role: "admin" | "operator" | "viewer";
      product_category: "cemimax" | "accessories";
      purchase_order_status: "paid" | "ready" | "shipped" | "arrived";
      shipment_status: "at_sea" | "arrived" | "completed";
      inventory_transaction_type:
        | "manual_add"
        | "manual_remove"
        | "purchase_order_arrived"
        | "purchase_order_reversed"
        | "shipment_arrived"
        | "shipment_reversed";
    };
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name: string;
          role?: Database["public"]["Enums"]["app_role"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          full_name?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          sku: string;
          category: Database["public"]["Enums"]["product_category"];
          current_stock: number;
          in_transit_stock: number;
          low_stock_warning_level: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sku: string;
          category?: Database["public"]["Enums"]["product_category"];
          current_stock?: number;
          in_transit_stock?: number;
          low_stock_warning_level?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          sku?: string;
          category?: Database["public"]["Enums"]["product_category"];
          current_stock?: number;
          in_transit_stock?: number;
          low_stock_warning_level?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_orders: {
        Row: {
          id: string;
          po_number: string;
          supplier: string;
          order_date: string;
          status: Database["public"]["Enums"]["purchase_order_status"];
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          po_number: string;
          supplier: string;
          order_date: string;
          status?: Database["public"]["Enums"]["purchase_order_status"];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          po_number?: string;
          supplier?: string;
          order_date?: string;
          status?: Database["public"]["Enums"]["purchase_order_status"];
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_order_items: {
        Row: {
          id: string;
          purchase_order_id: string;
          product_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          product_id: string;
          quantity: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          purchase_order_id?: string;
          product_id?: string;
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      shipments: {
        Row: {
          id: string;
          container_number: string;
          product_id: string;
          quantity: number;
          eta: string;
          arrival_status: Database["public"]["Enums"]["shipment_status"];
          linked_purchase_order_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          container_number: string;
          product_id: string;
          quantity: number;
          eta: string;
          arrival_status?: Database["public"]["Enums"]["shipment_status"];
          linked_purchase_order_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          container_number?: string;
          product_id?: string;
          quantity?: number;
          eta?: string;
          arrival_status?: Database["public"]["Enums"]["shipment_status"];
          linked_purchase_order_id?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory_transactions: {
        Row: {
          id: string;
          created_at: string;
          product_id: string;
          quantity: number;
          type: Database["public"]["Enums"]["inventory_transaction_type"];
          reason: string;
          reference_table: string | null;
          reference_id: string | null;
          performed_by: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          product_id: string;
          quantity: number;
          type: Database["public"]["Enums"]["inventory_transaction_type"];
          reason: string;
          reference_table?: string | null;
          reference_id?: string | null;
          performed_by?: string | null;
        };
        Update: {
          created_at?: string;
          product_id?: string;
          quantity?: number;
          type?: Database["public"]["Enums"]["inventory_transaction_type"];
          reason?: string;
          reference_table?: string | null;
          reference_id?: string | null;
          performed_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      perform_stock_adjustment: {
        Args: {
          p_product_id: string;
          p_adjustment: string;
          p_quantity: number;
          p_reason: string;
        };
        Returns: Database["public"]["Tables"]["inventory_transactions"]["Row"];
      };
      update_purchase_order_status: {
        Args: {
          p_purchase_order_id: string;
          p_status: Database["public"]["Enums"]["purchase_order_status"];
        };
        Returns: Database["public"]["Tables"]["purchase_orders"]["Row"];
      };
      save_purchase_order: {
        Args: {
          p_purchase_order_id?: string | null;
          p_po_number: string;
          p_supplier: string;
          p_order_date: string;
          p_status: Database["public"]["Enums"]["purchase_order_status"];
          p_items: Json;
          p_created_by?: string | null;
        };
        Returns: Database["public"]["Tables"]["purchase_orders"]["Row"];
      };
      delete_purchase_order: {
        Args: {
          p_purchase_order_id: string;
        };
        Returns: boolean;
      };
      update_shipment_status: {
        Args: {
          p_shipment_id: string;
          p_status: Database["public"]["Enums"]["shipment_status"];
        };
        Returns: Database["public"]["Tables"]["shipments"]["Row"];
      };
    };
    CompositeTypes: Record<string, never>;
  };
};

export type AppRole = Database["public"]["Enums"]["app_role"];
export type ProductCategory = Database["public"]["Enums"]["product_category"];
export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type PurchaseOrderRow = Database["public"]["Tables"]["purchase_orders"]["Row"];
export type PurchaseOrderItemRow = Database["public"]["Tables"]["purchase_order_items"]["Row"];
export type ShipmentRow = Database["public"]["Tables"]["shipments"]["Row"];
export type InventoryTransactionRow =
  Database["public"]["Tables"]["inventory_transactions"]["Row"];
