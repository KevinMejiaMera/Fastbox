// src/services/printerService.js
import api from './api';

const PRINTER_API_URL = `${process.env.REACT_APP_FAST_FOOD_SERVICE}/api/hardware`;

class PrinterService {
  async printReceipt(orderData, printerId = null) {
    try {
      const response = await api.post(`${PRINTER_API_URL}/print/receipt/`, {
        order: orderData,
        printer_id: printerId
      });
      
      // Manejo de impresoras RawBT
      // Si la respuesta incluye el texto del ticket y sabemos que la impresora seleccionada 
      // (o globalmente en configuración) es Inalámbrica RawBT, abrimos el Intent.
      // Aquí podemos asumir que si hay un 'receipt_text', siempre podemos intentar pasarlo 
      // a RawBT si estamos en un dispositivo móvil (o depender de un flag específico).
      if (response.data && response.data.receipt_text) {
        // Obtenemos la información de la impresora (podrías guardarlo en context o localStorage)
        // Por simplicidad, si la orden explícitamente se marca para RawBT o la impresora lo es
        const isRawbt = localStorage.getItem('defaultPrinterType') === 'rawbt' || 
                        response.data.connection_type === 'rawbt'; // Opcional, dependiendo de cómo manejes el state
        
        if (isRawbt) {
          const rawText = encodeURIComponent(response.data.receipt_text);
          window.location.href = `intent:${rawText}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('Error al imprimir ticket:', error);
      throw error;
    }
  }

  async openCashDrawer(printerId = null) {
    try {
      const response = await api.post(`${PRINTER_API_URL}/open-drawer/`, {
        printer_id: printerId
      });
      return response.data;
    } catch (error) {
      console.error('Error al abrir caja:', error);
      throw error;
    }
  }

  async getPrintStatus() {
    try {
      const response = await api.get(`${PRINTER_API_URL}/status/`);
      return response.data;
    } catch (error) {
      console.error('Error al obtener estado:', error);
      return null;
    }
  }

  async getSettings() {
    try {
      const response = await api.get(`${PRINTER_API_URL}/settings/`);
      return response.data;
    } catch (error) {
      console.error('Error al obtener configuración:', error);
      throw error;
    }
  }

  async updateSettings(settingsData) {
    try {
      const response = await api.put(`${PRINTER_API_URL}/settings/`, settingsData);
      return response.data;
    } catch (error) {
      console.error('Error al actualizar configuración:', error);
      throw error;
    }
  }

  async getPrinters() {
    try {
      const response = await api.get(`${PRINTER_API_URL}/printers/`);
      return response.data;
    } catch (error) {
      console.error('Error al obtener impresoras:', error);
      throw error;
    }
  }

  async createPrinter(printerData) {
    try {
      const response = await api.post(`${PRINTER_API_URL}/printers/`, printerData);
      return response.data;
    } catch (error) {
      console.error('Error al crear impresora:', error);
      throw error;
    }
  }

  async updatePrinter(id, printerData) {
    try {
      const response = await api.put(`${PRINTER_API_URL}/printers/${id}/`, printerData);
      return response.data;
    } catch (error) {
      console.error('Error al actualizar impresora:', error);
      throw error;
    }
  }

  async deletePrinter(id) {
    try {
      const response = await api.delete(`${PRINTER_API_URL}/printers/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error al eliminar impresora:', error);
      throw error;
    }
  }
}

export default new PrinterService();